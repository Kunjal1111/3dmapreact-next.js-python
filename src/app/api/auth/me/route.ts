import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getRequestSession(request);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}