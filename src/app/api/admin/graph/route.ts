import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import { requestOriginAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";
import { graphEdgeSchema, graphNodeSchema } from "@/lib/validation";

type NodeRow = RowDataPacket & { id: string; label: string; longitude: number; latitude: number };
type EdgeRow = RowDataPacket & { id: string; from_node_id: string; to_node_id: string; distance_meters: number; coordinates: [number, number][] | string; instruction: string; is_bidirectional: number };

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  try {
    const pool = getPool();
    const [nodes] = await pool.execute<NodeRow[]>("SELECT id, label, longitude, latitude FROM walking_nodes ORDER BY label");
    const [edges] = await pool.execute<EdgeRow[]>("SELECT id, from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional FROM walking_edges ORDER BY created_at");
    return NextResponse.json({
      nodes: nodes.map((node) => ({ id: node.id, label: node.label, longitude: Number(node.longitude), latitude: Number(node.latitude) })),
      edges: edges.map((edge) => ({ id: edge.id, fromNodeId: edge.from_node_id, toNodeId: edge.to_node_id, distanceMeters: Number(edge.distance_meters), coordinates: typeof edge.coordinates === "string" ? JSON.parse(edge.coordinates) : edge.coordinates, instruction: edge.instruction, isBidirectional: Boolean(edge.is_bidirectional) })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Walking graph services are unavailable.", 503); }
}

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  if (!body || typeof body !== "object" || !("kind" in body)) return errorResponse("Choose a graph node or edge operation.", 400);
  if (body.kind === "node") {
    const parsed = graphNodeSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Enter a valid surveyed node and coordinate.", 400);
    const id = randomUUID();
    try {
      await getPool().execute("INSERT INTO walking_nodes (id, label, longitude, latitude) VALUES (?, ?, ?, ?)", [id, parsed.data.label, parsed.data.longitude, parsed.data.latitude]);
      return NextResponse.json({ id }, { status: 201 });
    } catch { return errorResponse("Walking node could not be created.", 503); }
  }
  if (body.kind === "edge") {
    const parsed = graphEdgeSchema.safeParse(body);
    if (!parsed.success) return errorResponse("Enter a valid surveyed path with matching endpoint nodes.", 400);
    try {
      const pool = getPool();
      const [rows] = await pool.execute<NodeRow[]>("SELECT id, label, longitude, latitude FROM walking_nodes WHERE id IN (?, ?)", [parsed.data.fromNodeId, parsed.data.toNodeId]);
      const from = rows.find((node) => node.id === parsed.data.fromNodeId);
      const to = rows.find((node) => node.id === parsed.data.toNodeId);
      if (!from || !to) return errorResponse("Both endpoint nodes must exist.", 400);
      const start = parsed.data.coordinates[0];
      const end = parsed.data.coordinates.at(-1)!;
      const closeTo = (coordinate: [number, number], node: NodeRow) => Math.abs(coordinate[0] - Number(node.longitude)) <= 0.00005 && Math.abs(coordinate[1] - Number(node.latitude)) <= 0.00005;
      if (!closeTo(start, from) || !closeTo(end, to)) return errorResponse("Path endpoints must align with the selected surveyed nodes (within about 5 m).", 400);
      const id = randomUUID();
      await pool.execute("INSERT INTO walking_edges (id, from_node_id, to_node_id, distance_meters, coordinates, instruction, is_bidirectional) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, parsed.data.fromNodeId, parsed.data.toNodeId, parsed.data.distanceMeters, JSON.stringify(parsed.data.coordinates), parsed.data.instruction, parsed.data.isBidirectional]);
      return NextResponse.json({ id }, { status: 201 });
    } catch { return errorResponse("Walking edge could not be created.", 503); }
  }
  return errorResponse("Unsupported graph operation.", 400);
}

export async function DELETE(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const kind = searchParams.get("kind");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || (kind !== "edge" && kind !== "node")) return errorResponse("Choose a valid graph record to delete.", 400);
  try {
    const table = kind === "edge" ? "walking_edges" : "walking_nodes";
    const [result] = await getPool().execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if ((result as { affectedRows: number }).affectedRows === 0) return errorResponse("Graph record not found.", 404);
    return NextResponse.json({ ok: true });
  } catch { return errorResponse("Graph record could not be deleted.", 503); }
}