import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getRequestSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import type { AuthUser } from "@/lib/types";

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireAdmin(request: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getRequestSession(request);
  if (!user) return errorResponse("Authentication required.", 401);
  if (user.role !== "ADMIN") return errorResponse("Administrator access required.", 403);
  try {
    const [rows] = await getPool().execute<(RowDataPacket & { role: string })[]>("SELECT role FROM users WHERE id = ? LIMIT 1", [user.id]);
    if (rows[0]?.role !== "ADMIN") return errorResponse("Administrator access required.", 403);
  } catch {
    return errorResponse("Administrator access could not be verified.", 503);
  }
  return user;
}

export function isResponse(value: AuthUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}