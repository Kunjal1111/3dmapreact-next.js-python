import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import { requestOriginAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";
import { locationSchema } from "@/lib/validation";

type LocationRow = RowDataPacket & {
  id: string; name: string; description: string; category: string; longitude: number | null; latitude: number | null;
  entrance_latitude: number | null; entrance_longitude: number | null;
  source_url: string; is_verified: number; coordinates_verified: number; is_active: number; route_node_id: string | null;
};

function present(row: LocationRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    longitude: row.longitude === null ? null : Number(row.longitude),
    latitude: row.latitude === null ? null : Number(row.latitude),
    entranceLongitude: row.entrance_longitude === null ? null : Number(row.entrance_longitude),
    entranceLatitude: row.entrance_latitude === null ? null : Number(row.entrance_latitude),
    sourceUrl: row.source_url,
    isVerified: Boolean(row.is_verified),
    coordinatesVerified: Boolean(row.coordinates_verified) && row.longitude !== null && row.latitude !== null,
    isActive: Boolean(row.is_active),
    routeNodeId: row.route_node_id,
  };
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  try {
    const [rows] = await getPool().execute<LocationRow[]>(
      `SELECT id, name, description, category, longitude, latitude, entrance_latitude, entrance_longitude,
              source_url, is_verified, coordinates_verified, is_active, route_node_id
       FROM campus_locations ORDER BY updated_at DESC`,
    );
    return NextResponse.json({ locations: rows.map(present) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Campus location services are unavailable.", 503); }
}

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  if (!request.headers.get("content-type")?.includes("application/json")) return errorResponse("JSON request body required.", 415);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter valid location details and an official PPSU source URL.", 400);
  try {
    const id = randomUUID();
    const value = parsed.data;
    if (value.routeNodeId) {
      const [nodes] = await getPool().execute<(RowDataPacket & { longitude: number; latitude: number })[]>("SELECT longitude, latitude FROM walking_nodes WHERE id = ?", [value.routeNodeId]);
      const node = nodes[0];
      if (!node) return errorResponse("The selected walking node does not exist.", 400);
      if (Math.abs(Number(node.longitude) - value.longitude) > 0.00005 || Math.abs(Number(node.latitude) - value.latitude) > 0.00005) return errorResponse("A location pin must align with its walking node (within about 5 m).", 400);
    }
    await getPool().execute(
      `INSERT INTO campus_locations (id, name, description, category, longitude, latitude, source_url, route_node_id, is_verified, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE, ?)`,
      [id, value.name, value.description, value.category, value.longitude, value.latitude, value.sourceUrl, value.routeNodeId ?? null, user.id],
    );
    return NextResponse.json({ id, isVerified: false }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return errorResponse("A location with that name already exists.", 409);
    if (error && typeof error === "object" && "code" in error && error.code === "ER_NO_REFERENCED_ROW_2") return errorResponse("The selected walking node does not exist.", 400);
    return errorResponse("Campus location could not be created.", 503);
  }
}