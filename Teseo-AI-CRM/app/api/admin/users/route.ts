import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { UserRole } from "@/lib/validators/user";

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

  // 1. Obtener sesión actual
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Verificar que el usuario tenga rol ADMIN u OWNER
  const currentUserId = session.user.id;
  const { data: currentTenantUser, error: tenantUserError } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", currentUserId)
    .single();

  if (tenantUserError || !currentTenantUser) {
    return NextResponse.json({ error: "Usuario sin tenant asignado" }, { status: 403 });
  }

  if (currentTenantUser.role !== UserRole.ADMIN && currentTenantUser.role !== UserRole.OWNER) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  }

  const currentTenantId = currentTenantUser.tenant_id;

  // 3. Instanciar cliente Admin
  const adminClient = getAdminClient();

  // 4. Obtener tenant_users y auth.users
  const { data: tenantUsers, error: usersError } = await adminClient
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", currentTenantId);

  if (usersError || !tenantUsers) {
    return NextResponse.json({ error: "Error al obtener usuarios del tenant" }, { status: 500 });
  }

  const { data: authUsersData, error: authUsersError } = await adminClient.auth.admin.listUsers();

  if (authUsersError) {
    return NextResponse.json({ error: "Error al obtener auth users" }, { status: 500 });
  }

  const authUsers = authUsersData.users;

  // 5. Mapear cruce de datos
  const userProfiles = tenantUsers.map((tu) => {
    const authUser = authUsers.find((au) => au.id === tu.user_id);
    return {
      id: tu.user_id,
      tenant_id: tu.tenant_id,
      role: tu.role,
      created_at: tu.created_at,
      email: authUser?.email || "Sin email",
      full_name: authUser?.user_metadata?.full_name || null,
      avatar_url: authUser?.user_metadata?.avatar_url || null,
    };
  });

  return NextResponse.json(userProfiles);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const currentUserId = session.user.id;
  const { data: currentTenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", currentUserId)
    .single();

  if (!currentTenantUser || (currentTenantUser.role !== UserRole.ADMIN && currentTenantUser.role !== UserRole.OWNER)) {
    return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  }

  const payload = await request.json();
  const adminClient = getAdminClient();

  // Create user passing the tenant_id in user_metadata explicitly
  const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
    email: payload.email,
    email_confirm: true,
    user_metadata: {
      tenant_id: currentTenantUser.tenant_id,
      full_name: payload.name,
    }
  });

  if (createError || !authData.user) {
    return NextResponse.json({ error: createError?.message || "Error al crear auth user" }, { status: 400 });
  }

  const { error: insertError } = await adminClient.from("tenant_users").insert({
    user_id: authData.user.id,
    tenant_id: currentTenantUser.tenant_id,
    role: payload.role || UserRole.MEMBER,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ 
    id: authData.user.id,
    email: authData.user.email,
    tenant_id: currentTenantUser.tenant_id,
    role: payload.role || UserRole.MEMBER
  });
}
