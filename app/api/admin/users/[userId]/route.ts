import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { UserRole } from "@/lib/validators/user";
import { pool } from "@/lib/db";

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

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  const adminClient = getAdminClient();

  // Obtener usuario de Auth
  const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(userId);
  if (authError || !authUser.user) {
    return NextResponse.json({ error: "Usuario no encontrado en Auth" }, { status: 404 });
  }

  // Obtener registro de tenant_users desde Cloud SQL
  let tu = null;
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT * FROM tenant_users WHERE user_id = $1', [userId]);
    if (res.rows.length > 0) {
      tu = res.rows[0];
    }
    client.release();
  } catch (err) {
    console.error("Error fetching tenant_user from Cloud SQL:", err);
  }

  const userProfile = {
    id: authUser.user.id,
    tenant_id: tu ? tu.tenant_id : null,
    role: tu ? tu.role : 'GLOBAL_ADMIN',
    created_at: authUser.user.created_at,
    email: authUser.user.email || "Sin email",
    full_name: authUser.user.user_metadata?.full_name || null,
    avatar_url: authUser.user.user_metadata?.avatar_url || null,
  };

  return NextResponse.json(userProfile);
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { userId } = await context.params;
  const body = await request.json();
  const adminClient = getAdminClient();

  // Actualizar metadatos en Auth (ej: nombre) si se enviaron
  if (body.full_name || body.name) {
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: body.full_name || body.name }
    });
  }

  // Actualizar el rol en Cloud SQL
  if (body.role) {
    try {
      const client = await pool.connect();
      await client.query('UPDATE tenant_users SET role = $1 WHERE user_id = $2', [body.role, userId]);
      client.release();
    } catch (err) {
      console.error("Error updating role in Cloud SQL:", err);
      return NextResponse.json({ error: "Error al actualizar rol en base de datos" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, id: userId, ...body });
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { userId } = await context.params;
  const adminClient = getAdminClient();

  // Eliminar de Auth
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar el usuario de Auth" }, { status: 500 });
  }

  // Eliminar de Cloud SQL
  try {
    const client = await pool.connect();
    await client.query('DELETE FROM tenant_users WHERE user_id = $1', [userId]);
    client.release();
  } catch (err) {
    console.error("Error deleting from Cloud SQL:", err);
  }

  return NextResponse.json({ success: true });
}
