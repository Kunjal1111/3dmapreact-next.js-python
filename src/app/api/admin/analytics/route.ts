import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import { getPool } from "@/lib/db";
import { errorResponse, isResponse, requireAdmin } from "@/lib/http";

type AnalyticsRow = RowDataPacket & { event_date: Date | string; event_type: string; event_count: number };

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (isResponse(user)) return user;
  try {
    const [rows] = await getPool().execute<AnalyticsRow[]>(
      `SELECT event_date, event_type, event_count
       FROM daily_analytics
       WHERE event_date >= UTC_DATE() - INTERVAL 29 DAY
       ORDER BY event_date DESC`,
    );
    return NextResponse.json({ analytics: rows.map((row) => ({ date: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : row.event_date.slice(0, 10), type: row.event_type, count: Number(row.event_count) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return errorResponse("Analytics are unavailable.", 503); }
}