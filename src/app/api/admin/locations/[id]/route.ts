import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { requestOriginAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";
import { locationSchema } from "@/lib/validation";

const updateSchema = locationSchema.partial().extend({
  entranceLatitude: z.number().finite().min(-90).max(90).nullable().optional(),
  entranceLongitude: z.number().finite().min(-180).max(180).nullable().optional(),
  isVerified: z.boolean().optional(),
  coordinatesVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

const columns: Record<string, string> = {
  name: "name", description: "description", category: "category",
  longitude: "longitude", latitude: "latitude",
  entranceLatitude: "entrance_latitude", entranceLongitude: "entrance_longitude",
  sourceUrl: "source_url", routeNodeId: "route_node_id",
  isVerified: "is_verified", coordinatesVerified: "coordinates_verified", isActive: "is_active",
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("Invalid location ID.", 400);
  if (!request.headers.get("content-type")?.includes("application/json")) return errorResponse("JSON request body required.", 415);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter valid location updates.", 400);
  const entries = Object.entries(parsed.data).filter(([key]) => columns[key]);
  if (!entries.length) return errorResponse("No supported changes were provided.", 400);
  try {
    const [existingRows] = await getPool().execute<(RowDataPacket & { longitude: number | null; latitude: number | null; route_node_id: string | null })[]>("SELECT longitude, latitude, route_node_id FROM campus_locations WHERE id = ? LIMIT 1", [id]);
    const existing = existingRows[0];
    if (!existing) return errorResponse("Location not found.", 404);
    const nextLongitude = parsed.data.longitude ?? (existing.longitude === null ? null : Number(existing.longitude));
    const nextLatitude = parsed.data.latitude ?? (existing.latitude === null ? null : Number(existing.latitude));
    const nextNodeId = parsed.data.routeNodeId === undefined ? existing.route_node_id : parsed.data.routeNodeId;
    if (nextNodeId) {
      if (nextLongitude === null || nextLatitude === null) return errorResponse("Surveyed coordinates are required before connecting a walking node.", 400);
      const [nodes] = await getPool().execute<(RowDataPacket & { longitude: number; latitude: number })[]>("SELECT longitude, latitude FROM walking_nodes WHERE id = ? LIMIT 1", [nextNodeId]);
      const node = nodes[0];
      if (!node) return errorResponse("The selected walking node does not exist.", 400);
      if (Math.abs(Number(node.longitude) - nextLongitude) > 0.00005 || Math.abs(Number(node.latitude) - nextLatitude) > 0.00005) return errorResponse("A location pin must align with its walking node (within about 5 m).", 400);
    }
    if (parsed.data.coordinatesVerified === true && (nextLongitude === null || nextLatitude === null)) return errorResponse("Add surveyed coordinates before verifying a map pin.", 400);
    const coordinateChanged = parsed.data.longitude !== undefined || parsed.data.latitude !== undefined;
    if (coordinateChanged && parsed.data.coordinatesVerified === undefined) entries.push(["coordinatesVerified", false]);
    const assignments = entries.map(([key]) => `\`${columns[key]}\` = ?`).join(", ");
    const values = entries.map(([key, value]) => key === "routeNodeId" ? value ?? null : key === "isVerified" || key === "coordinatesVerified" || key === "isActive" ? value ? 1 : 0 : value);
    const [result] = await getPool().execute(`UPDATE campus_locations SET ${assignments} WHERE id = ?`, [...values, id]);
    if ((result as { affectedRows: number }).affectedRows === 0) return errorResponse("Location not found or unchanged.", 404);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Location update could not be saved.", 503); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("Invalid location ID.", 400);
  try {
    const [result] = await getPool().execute("DELETE FROM campus_locations WHERE id = ?", [id]);
    if ((result as { affectedRows: number }).affectedRows === 0) return errorResponse("Location not found.", 404);
    return NextResponse.json({ ok: true });
  } catch { return errorResponse("Location could not be deleted.", 503); }
}