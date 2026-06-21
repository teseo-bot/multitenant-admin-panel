import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // Listar todos los tenants es operación de plataforma (flag, no email).
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    logger.warn('api.tenant.denied', { status: auth.status });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
     const client = await pool.connect();
     const res = await client.query('SELECT id, name, domain, status, created_at FROM tenants ORDER BY created_at DESC');
     client.release();
     return NextResponse.json(res.rows);
  } catch (err) {
     logger.error('api.tenant.cloud_sql_error', { error: String(err) });
     return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
}
