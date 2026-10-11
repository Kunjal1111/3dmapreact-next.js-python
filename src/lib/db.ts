import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_NOT_CONFIGURED");
  const databaseUrl = new URL(url);
  pool = mysql.createPool({
    host: databaseUrl.hostname,
    port: Number(databaseUrl.port || 3306),
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")),
    connectionLimit: 8,
    maxIdle: 4,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    charset: "utf8mb4",
    timezone: "Z",
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
  });
  return pool;
}

export async function inTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function isDatabaseUnavailable(error: unknown): boolean {
  return error instanceof Error && (error.message === "DATABASE_NOT_CONFIGURED" || "code" in error);
}