import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { UserRole } from "@/lib/validators/user";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

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
  const supabase = await createClient();

  // 1. Obtener usuario actual (validación server-side)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    logger.warn('api.admin.users.unauthorized', { hasUser: !!user, error: userError?.message });
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentEmail = user.email;
  const isGlobalAdmin = currentEmail === process.env.PLATFORM_ADMIN_EMAIL || currentEmail === 'jorge@teseo.lat';

  if (!isGlobalAdmin) {
    logger.warn('api.admin.users.forbidden', { email: currentEmail });
    return NextResponse.json({ error: "Solo Global Admin puede acceder al panel multitenant" }, { status: 403 });
  }

  // 3. Instanciar cliente Admin
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
      role: tu ? tu.role : 'GLOBAL_ADMIN',
      created_at: au.created_at,
      email: au.email || "Sin email",
      full_name: au.user_metadata?.full_name || null,
      avatar_url: au.user_metadata?.avatar_url || null,
    };
  });

  return NextResponse.json(userProfiles);
}
