import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createSession, requestOriginAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema } from "@/lib/validation";

const schema = z.object({ email: emailSchema, password: passwordSchema });
type UserRow = RowDataPacket & { id: string; name: string; email: string; password_hash: string; role: "USER" | "ADMIN" };
const dummyPasswordHash = bcrypt.hash("not-a-real-ppsu-account-password", 12);

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return errorResponse("JSON request body required.", 415);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter a valid email and password.", 400);
  try {
    if (!await enforceRateLimit(request, "login", 10, 900)) return errorResponse("Too many attempts. Try again later.", 429);
    const [rows] = await getPool().execute<UserRow[]>("SELECT id, name, email, password_hash, role FROM users WHERE email = ? LIMIT 1", [parsed.data.email]);
    const row = rows[0];
    const passwordMatches = await bcrypt.compare(parsed.data.password, row?.password_hash ?? await dummyPasswordHash);
    if (!row || !passwordMatches) return errorResponse("Email or password is incorrect.", 401);
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
    await createSession(user, response);
    return response;
  } catch {
    return errorResponse("Sign-in is temporarily unavailable.", 503);
  }
}