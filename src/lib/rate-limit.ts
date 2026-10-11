import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { getPool } from "@/lib/db";

export async function enforceRateLimit(request: NextRequest, scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const bucket = createHmac("sha256", secret).update(`${scope}:${address}`).digest("hex");
  const pool = getPool();
  await pool.execute(
    `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, hit_count)
     VALUES (?, UTC_TIMESTAMP(), 1)
     ON DUPLICATE KEY UPDATE
       hit_count = IF(window_started_at <= TIMESTAMPADD(SECOND, -?, UTC_TIMESTAMP()), 1, hit_count + 1),
       window_started_at = IF(window_started_at <= TIMESTAMPADD(SECOND, -?, UTC_TIMESTAMP()), UTC_TIMESTAMP(), window_started_at)`,
    [bucket, windowSeconds, windowSeconds],
  );
  const [current] = await pool.execute("SELECT hit_count FROM rate_limit_buckets WHERE bucket_key = ?", [bucket]);
  const hitCount = Number((current as { hit_count: number }[])[0]?.hit_count ?? limit + 1);
  return hitCount <= limit;
}