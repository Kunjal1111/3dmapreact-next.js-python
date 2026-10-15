import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let connOk = false;
  let nodesCount = 0;
  let edgesCount = 0;
  let isConnected = false;

  try {
    const pool = getPool();
    await pool.execute("SELECT 1");
    connOk = true;

    const [nodeRows] = await pool.execute<(RowDataPacket & { cnt: number })[]>("SELECT COUNT(*) AS cnt FROM walking_nodes");
    const [edgeRows] = await pool.execute<(RowDataPacket & { cnt: number })[]>("SELECT COUNT(*) AS cnt FROM walking_edges");
    nodesCount = Number(nodeRows[0]?.cnt ?? 0);
    edgesCount = Number(edgeRows[0]?.cnt ?? 0);
    isConnected = nodesCount > 0 && edgesCount > 0;
  } catch {
    connOk = false;
  }

  return NextResponse.json({
    status: connOk ? "healthy" : "database_disconnected",
    nodeVersion: process.version,
    databaseConnected: connOk,
    graph: {
      nodesCount,
      edgesCount,
      isConnected,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
