import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = 'force-dynamic';

// Crear un cliente con la clave maestra (Service Role)
const getAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};

export async function GET() {
  // Autorización centralizada: requiere Platform Admin (flag app_metadata, no email).
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    logger.warn('api.admin.users.denied', { status: auth.status });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = getAdminClient();

  // 4. Obtener todos los auth.users
  const { data: authUsersData, error: authUsersError } = await adminClient.auth.admin.listUsers();

  if (authUsersError) {
    return NextResponse.json({ error: "Error al obtener auth users" }, { status: 500 });
  }

  const authUsers = authUsersData.users;

  // 5. Obtener todos los tenant_users desde Cloud SQL (la fuente real de datos)
  let tenantUsers = [];
  try {
     const client = await pool.connect();
     const res = await client.query('SELECT * FROM tenant_users');
     tenantUsers = res.rows;
     client.release();
  } catch (err) {
     logger.error('api.admin.users.cloud_sql_error', { error: String(err) });
  }

  // 6. Mapear cruce de datos
  const userProfiles = authUsers.map((au) => {
    const tu = tenantUsers.find((t) => t.user_id === au.id);
    return {
      id: au.id,
      tenant_id: tu ? tu.tenant_id : null,
      // Sin membresía => sin rol de tenant. NUNCA elevar a admin por ausencia de fila.
      role: tu ? tu.role : null,
      // El privilegio de plataforma es explícito (flag), no un fallback ni email.
      is_platform_admin: au.app_metadata?.platform_admin === true,
      created_at: au.created_at,
      email: au.email || "Sin email",
      full_name: au.user_metadata?.full_name || null,
      avatar_url: au.user_metadata?.avatar_url || null,
    };
  });

  return NextResponse.json(userProfiles);
}
