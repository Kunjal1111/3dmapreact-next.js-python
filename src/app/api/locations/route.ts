import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

type LocationRow = RowDataPacket & {
  id: string; name: string; description: string; category: string; longitude: number | null; latitude: number | null;
  entrance_latitude: number | null; entrance_longitude: number | null;
  source_url: string; is_verified: number; coordinates_verified: number; route_node_id: string | null;
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = await getPool().execute<LocationRow[]>(
      `SELECT id, name, description, category, longitude, latitude, entrance_latitude, entrance_longitude,
              source_url, is_verified, route_node_id, coordinates_verified
       FROM campus_locations WHERE is_verified = TRUE AND is_active = TRUE ORDER BY category, name`,
    );
    const locations = rows.map((row) => ({
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
      routeNodeId: row.route_node_id,
    }));
    return NextResponse.json({ locations }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Campus location services are not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}