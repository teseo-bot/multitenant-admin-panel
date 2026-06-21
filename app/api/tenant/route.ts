import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    logger.warn('api.tenant.unauthorized', { hasUser: !!user, error: userError?.message });
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentEmail = user.email;
  const isGlobalAdmin = currentEmail === process.env.PLATFORM_ADMIN_EMAIL;

  if (!isGlobalAdmin) {
    logger.warn('api.tenant.forbidden', { email: currentEmail });
    return NextResponse.json({ error: "Solo Global Admin puede listar tenants" }, { status: 403 });
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
