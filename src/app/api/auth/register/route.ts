import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createSession, requestOriginAllowed } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { emailSchema, passwordSchema } from "@/lib/validation";

const schema = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema });

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return errorResponse("JSON request body required.", 415);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Invalid request body.", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter a valid name, email, and password of at least 8 characters.", 400);
  try {
    if (!await enforceRateLimit(request, "register", 5, 3600)) return errorResponse("Too many attempts. Try again later.", 429);
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await getPool().execute("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'USER')", [id, parsed.data.name, parsed.data.email, passwordHash]);
    const user = { id, name: parsed.data.name, email: parsed.data.email, role: "USER" as const };
    const response = NextResponse.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
    await createSession(user, response);
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") return errorResponse("An account with that email already exists.", 409);
    return errorResponse("Account registration is temporarily unavailable.", 503);
  }
}