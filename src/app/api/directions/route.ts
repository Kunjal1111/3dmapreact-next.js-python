import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { findShortestWalkingRoute, type RouteEdge, type RouteNode } from "@/lib/routing";

const requestSchema = z.object({ fromId: z.string().uuid(), toId: z.string().uuid() });
type LocationRow = RowDataPacket & { id: string; route_node_id: string | null; is_verified: number; coordinates_verified: number; longitude: number | null; latitude: number | null };
type NodeRow = RowDataPacket & { id: string; label: string; longitude: number; latitude: number };
type EdgeRow = RowDataPacket & { from_node_id: string; to_node_id: string; distance_meters: number; coordinates: [number, number][] | string; instruction: string; is_bidirectional: number };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!await enforceRateLimit(request, "directions", 60, 60)) return errorResponse("Too many route requests. Try again shortly.", 429);
  } catch {
    return errorResponse("Campus route services are not configured yet.", 503);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose two valid campus locations." }, { status: 400 });
  try {
    const pool = getPool();
    const [locationRows] = await pool.execute<LocationRow[]>(
      "SELECT id, name, route_node_id, is_verified, coordinates_verified, longitude, latitude FROM campus_locations WHERE id IN (?, ?) AND is_active = TRUE",
      [parsed.data.fromId, parsed.data.toId],
    );
    const from = locationRows.find((location) => location.id === parsed.data.fromId);
    const to = locationRows.find((location) => location.id === parsed.data.toId);

    if (!from || !to) {
      return NextResponse.json({ error: "One or both selected campus locations were not found." }, { status: 404 });
    }

    if (!from.coordinates_verified || from.longitude === null || from.latitude === null) {
      return NextResponse.json({
        error: `Walking route currently unavailable: coordinates pending for '${from.name || "starting location"}'.`
      }, { status: 422 });
    }

    if (!to.coordinates_verified || to.longitude === null || to.latitude === null) {
      return NextResponse.json({
        error: `Walking route currently unavailable: coordinates pending for '${to.name || "destination location"}'.`
      }, { status: 422 });
    }

    const [nodeRows] = await pool.execute<NodeRow[]>("SELECT id, label, longitude, latitude FROM walking_nodes");
    const [edgeRows] = await pool.execute<EdgeRow[]>("SELECT from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional FROM walking_edges");
    const nodes: RouteNode[] = nodeRows.map((row) => ({ id: row.id, label: row.label, longitude: Number(row.longitude), latitude: Number(row.latitude) }));
    const edges: RouteEdge[] = edgeRows.map((row) => ({
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      distanceMeters: Number(row.distance_meters),
      coordinates: typeof row.coordinates === "string" ? JSON.parse(row.coordinates) as [number, number][] : row.coordinates,
      instruction: row.instruction,
      isBidirectional: Boolean(row.is_bidirectional),
    }));

    // Helper to find nearest walking node if route_node_id is unassigned or not in nodeRows
    const findNearestNodeId = (targetLat: number, targetLon: number): string | null => {
      let nearestId: string | null = null;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const node of nodes) {
        const dLat = (node.latitude - targetLat) * 111000;
        const dLon = (node.longitude - targetLon) * 111000 * Math.cos(targetLat * Math.PI / 180);
        const dist = Math.hypot(dLat, dLon);
        if (dist < minDistance) {
          minDistance = dist;
          nearestId = node.id;
        }
      }
      return nearestId;
    };

    const fromNodeId = from.route_node_id ?? findNearestNodeId(Number(from.latitude), Number(from.longitude));
    const toNodeId = to.route_node_id ?? findNearestNodeId(Number(to.latitude), Number(to.longitude));

    if (!fromNodeId || !toNodeId) {
      return NextResponse.json({
        error: "Walking route currently unavailable: facility entrance not connected to campus pedestrian walkways."
      }, { status: 422 });
    }

    // TypeScript Dijkstra routing engine (replaces the former Python NetworkX microservice)
    const route = findShortestWalkingRoute(nodes, edges, fromNodeId, toNodeId);

    if (!route) {
      return NextResponse.json({
        error: "Walking route currently unavailable for this location: no connected path found."
      }, { status: 404 });
    }

    return NextResponse.json({ route }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Campus route services are not configured yet." }, { status: 503 });
  }
}