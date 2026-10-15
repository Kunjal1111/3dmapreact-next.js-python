import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { requestOriginAllowed } from "@/lib/auth";
import { inTransaction } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";

/**
 * Haversine distance between two coordinates in metres.
 * Replaces geopy.distance.geodesic from the Python service.
 */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/admin/graph/sync
 *
 * Fetch OpenStreetMap campus walkways via Overpass, build a connected graph,
 * extract the largest connected component, and populate MySQL walking_nodes
 * and walking_edges tables. Then snap verified campus locations to the
 * nearest graph node.
 *
 * This is the TypeScript port of POST /api/python/graph/sync from main.py.
 * It replaces NetworkX with a simple adjacency-list BFS/union-find approach.
 */
export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;

  // ── 1. Fetch OSM data via Overpass ──────────────────────────────
  const overpassUrl = "https://overpass-api.de/api/interpreter";
  const overpassQuery = `[out:json][timeout:30];
(
  way["highway"](21.491,73.001,21.503,73.013);
);
out body;
>;
out skel qt;`;

  let elements: { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }[];
  try {
    const res = await fetch(overpassUrl, {
      method: "POST",
      headers: { "User-Agent": "PPSU-Campus-Nav/1.0", "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    elements = data.elements ?? [];
  } catch (err) {
    return errorResponse(`Failed to fetch OpenStreetMap data: ${err instanceof Error ? err.message : err}`, 502);
  }

  // ── 2. Parse nodes and ways ─────────────────────────────────────
  const nodesMap = new Map<string, { lat: number; lon: number }>();
  const waysList: { nodes: string[]; name: string }[] = [];

  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodesMap.set(String(el.id), { lat: el.lat, lon: el.lon });
    } else if (el.type === "way" && el.nodes) {
      const tags = el.tags ?? {};
      waysList.push({
        nodes: el.nodes.map(String),
        name: tags.name ?? tags.highway ?? "Campus Path",
      });
    }
  }

  if (nodesMap.size === 0 || waysList.length === 0) {
    return errorResponse("No pedestrian graph elements found in target campus bounding box.", 404);
  }

  // ── 3. Build adjacency list ─────────────────────────────────────
  type GraphNode = { lat: number; lon: number; label: string };
  type GraphEdge = { u: string; v: string; distance: number; coords: [number, number][]; instruction: string };

  const graphNodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, Set<string>>();
  const edgesList: GraphEdge[] = [];

  // Register all OSM nodes that appear in ways
  for (const way of waysList) {
    for (const nId of way.nodes) {
      const pos = nodesMap.get(nId);
      if (pos && !graphNodes.has(nId)) {
        graphNodes.set(nId, { lat: pos.lat, lon: pos.lon, label: `OSM Node ${nId}` });
        adjacency.set(nId, new Set());
      }
    }
  }

  // Build edges
  for (const way of waysList) {
    const nodeIds = way.nodes.filter((n) => graphNodes.has(n));
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const u = nodeIds[i];
      const v = nodeIds[i + 1];
      const uPos = graphNodes.get(u)!;
      const vPos = graphNodes.get(v)!;
      const dist = Math.round(haversineMeters(uPos.lat, uPos.lon, vPos.lat, vPos.lon) * 100) / 100;
      const coords: [number, number][] = [[uPos.lon, uPos.lat], [vPos.lon, vPos.lat]];
      edgesList.push({ u, v, distance: dist, coords, instruction: `Walk along ${way.name}` });
      adjacency.get(u)!.add(v);
      adjacency.get(v)!.add(u);
    }
  }

  // Remove isolated nodes
  for (const [nodeId, neighbours] of adjacency) {
    if (neighbours.size === 0) {
      graphNodes.delete(nodeId);
      adjacency.delete(nodeId);
    }
  }

  // ── 4. Find largest connected component (BFS) ───────────────────
  const visited = new Set<string>();
  let largestComponent = new Set<string>();

  for (const startNode of graphNodes.keys()) {
    if (visited.has(startNode)) continue;
    const component = new Set<string>();
    const queue = [startNode];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.add(current);
      for (const neighbour of adjacency.get(current) ?? []) {
        if (!visited.has(neighbour)) queue.push(neighbour);
      }
    }
    if (component.size > largestComponent.size) {
      largestComponent = component;
    }
  }

  if (largestComponent.size === 0) {
    return errorResponse("No connected graph component found.", 422);
  }

  // Filter edges to largest component
  const connectedEdges = edgesList.filter((e) => largestComponent.has(e.u) && largestComponent.has(e.v));

  // ── 5. Write to MySQL ───────────────────────────────────────────
  try {
    const result = await inTransaction(async (conn) => {
      // Clear existing graph
      await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
      await conn.execute("TRUNCATE TABLE walking_edges");
      await conn.execute("TRUNCATE TABLE walking_nodes");
      await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

      // Map OSM node IDs → DB UUIDs
      const nodeUuidMap = new Map<string, string>();
      for (const osmId of largestComponent) {
        const dbUuid = randomUUID();
        nodeUuidMap.set(osmId, dbUuid);
        const nd = graphNodes.get(osmId)!;
        await conn.execute(
          "INSERT INTO walking_nodes (id, label, longitude, latitude) VALUES (?, ?, ?, ?)",
          [dbUuid, nd.label, nd.lon, nd.lat],
        );
      }

      // Insert edges
      let edgeCount = 0;
      for (const edge of connectedEdges) {
        const edgeUuid = randomUUID();
        await conn.execute(
          `INSERT INTO walking_edges
             (id, from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional)
           VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [edgeUuid, nodeUuidMap.get(edge.u)!, nodeUuidMap.get(edge.v)!, edge.distance, JSON.stringify(edge.coords), edge.instruction],
        );
        edgeCount++;
      }

      // Snap verified campus locations to nearest graph node
      const [verifiedRows] = await conn.execute<(RowDataPacket & { id: string; name: string; longitude: number; latitude: number })[]>(
        "SELECT id, name, longitude, latitude FROM campus_locations WHERE coordinates_verified = TRUE AND longitude IS NOT NULL AND latitude IS NOT NULL",
      );

      for (const loc of verifiedRows) {
        const locLat = Number(loc.latitude);
        const locLon = Number(loc.longitude);
        let minDist = Infinity;
        let bestNodeUuid: string | null = null;

        for (const osmId of largestComponent) {
          const nd = graphNodes.get(osmId)!;
          const d = haversineMeters(locLat, locLon, nd.lat, nd.lon);
          if (d < minDist) {
            minDist = d;
            bestNodeUuid = nodeUuidMap.get(osmId)!;
          }
        }

        if (bestNodeUuid) {
          await conn.execute("UPDATE campus_locations SET route_node_id = ? WHERE id = ?", [bestNodeUuid, loc.id]);
        }
      }

      return {
        success: true,
        nodesInserted: largestComponent.size,
        edgesInserted: edgeCount,
        snappedLocationsCount: verifiedRows.length,
      };
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(`Failed to sync graph to database: ${err instanceof Error ? err.message : err}`, 500);
  }
}
