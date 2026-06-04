import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pool } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentEmail = session.user.email;
  const isGlobalAdmin = currentEmail === process.env.PLATFORM_ADMIN_EMAIL || currentEmail === 'admin@teseo.lat';

  if (!isGlobalAdmin) {
    return NextResponse.json({ error: "Solo Global Admin puede listar tenants" }, { status: 403 });
  }

  try {
     const client = await pool.connect();
     const res = await client.query('SELECT id, name, domain, status, created_at FROM tenants ORDER BY created_at DESC');
     client.release();
     return NextResponse.json(res.rows);
  } catch (err) {
     console.error("Error fetching tenants from Cloud SQL:", err);
     return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
  }
}
