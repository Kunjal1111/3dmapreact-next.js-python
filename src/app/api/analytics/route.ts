import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const eventSchema = z.object({ type: z.enum(["search", "route", "location_view"]) });
export async function POST(request: NextRequest) {
  try {
    if (!await enforceRateLimit(request, "analytics", 60, 60)) return errorResponse("Too many analytics events.", 429);
  } catch {
    return errorResponse("Analytics are temporarily unavailable.", 503);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Unsupported analytics event." }, { status: 400 });
  try {
    await getPool().execute(
      `INSERT INTO daily_analytics (event_date, event_type, event_count)
       VALUES (UTC_DATE(), ?, 1)
       ON DUPLICATE KEY UPDATE event_count = event_count + 1`,
      [parsed.data.type],
    );
  } catch {
    return NextResponse.json({ error: "Analytics are temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
