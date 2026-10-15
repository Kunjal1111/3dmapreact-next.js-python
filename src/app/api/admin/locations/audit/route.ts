import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";

// PPSU Dhamdod Campus geographic bounds (same as the Python service)
const CAMPUS_MIN_LAT = 21.485;
const CAMPUS_MAX_LAT = 21.515;
const CAMPUS_MIN_LON = 72.995;
const CAMPUS_MAX_LON = 73.020;

type LocationRow = RowDataPacket & {
  id: string;
  name: string;
  description: string;
  category: string;
  longitude: number | null;
  latitude: number | null;
  source_url: string;
  is_verified: number;
  coordinates_verified: number;
  route_node_id: string | null;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;

  try {
    const [rows] = await getPool().execute<LocationRow[]>(
      `SELECT id, name, description, category, longitude, latitude,
              source_url, is_verified, coordinates_verified, route_node_id
       FROM campus_locations ORDER BY name`,
    );

    const auditResults = rows.map((r) => {
      const lon = r.longitude === null ? null : Number(r.longitude);
      const lat = r.latitude === null ? null : Number(r.latitude);
      const coordsVerified = Boolean(r.coordinates_verified);

      let auditStatus: string;
      let details: string;

      if (lat === null || lon === null) {
        auditStatus = "UNVERIFIED_MISSING_COORDINATES";
        details = "Missing geographic coordinates. Requires physical campus survey.";
      } else if (
        lat < CAMPUS_MIN_LAT || lat > CAMPUS_MAX_LAT ||
        lon < CAMPUS_MIN_LON || lon > CAMPUS_MAX_LON
      ) {
        auditStatus = "INVALID_COORDINATES";
        details = `Coordinates (${lat}, ${lon}) are outside official PPSU Dhamdod campus boundary.`;
      } else if (coordsVerified) {
        auditStatus = "VERIFIED";
        details = "Coordinates verified against authoritative campus imagery & OSM.";
      } else {
        auditStatus = "UNVERIFIED_PENDING_SURVEY";
        details = "Coordinates present but pending formal verification.";
      }

      return {
        id: r.id,
        name: r.name,
        category: r.category,
        latitude: lat,
        longitude: lon,
        isVerified: Boolean(r.is_verified),
        coordinatesVerified: coordsVerified && auditStatus === "VERIFIED",
        routeNodeId: r.route_node_id,
        auditStatus,
        details,
        sourceUrl: r.source_url,
      };
    });

    return NextResponse.json(
      {
        totalLocations: rows.length,
        verifiedCount: auditResults.filter((a) => a.auditStatus === "VERIFIED").length,
        unverifiedMissingCount: auditResults.filter((a) => a.auditStatus === "UNVERIFIED_MISSING_COORDINATES").length,
        locations: auditResults,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse("Database error during location audit.", 500);
  }
}
