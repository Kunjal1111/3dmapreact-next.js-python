import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSession, requestOriginAllowed } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) return errorResponse("Request origin is not allowed.", 403);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  await clearSession(response);
  return response;
}