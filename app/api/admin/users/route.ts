import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { UserRole } from "@/lib/validators/user";
import { pool } from "@/lib/db";

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
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const currentEmail = user.email;
  const isGlobalAdmin = currentEmail === process.env.PLATFORM_ADMIN_EMAIL || currentEmail === 'jorge@teseo.lat';

  if (!isGlobalAdmin) {
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
     console.error("Error fetching tenant_users from Cloud SQL:", err);
     // Si falla la BD, al menos devolvemos los authUsers con tenant_id nulo
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
