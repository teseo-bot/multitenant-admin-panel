import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/gcp-auth/admin";
import { pool } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await context.params;

  // Obtener usuario de Firebase Auth
  let authUser;
  try {
    authUser = await adminAuth().getUser(userId);
  } catch {
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
    id: authUser.uid,
    tenant_id: tu ? tu.tenant_id : null,
    // Sin membresía => sin rol de tenant. NUNCA elevar a admin por ausencia de fila.
    role: tu ? tu.role : null,
    is_platform_admin: authUser.customClaims?.platform_admin === true,
    created_at: authUser.metadata?.creationTime || null,
    email: authUser.email || "Sin email",
    full_name: authUser.displayName || null,
    avatar_url: null,
  };

  return NextResponse.json(userProfile);
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await context.params;
  const body = await request.json();

  // Actualizar displayName en Firebase Auth (equivalente a full_name) si se envió
  if (body.full_name || body.name) {
    try {
      await adminAuth().updateUser(userId, {
        displayName: body.full_name || body.name
      });
    } catch (err) {
      console.error("Error updating displayName in Firebase:", err);
      return NextResponse.json({ error: "Error al actualizar nombre en Auth" }, { status: 500 });
    }
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
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await context.params;

  // Eliminar de Firebase Auth
  try {
    await adminAuth().deleteUser(userId);
  } catch (err) {
    console.error("Error deleting user from Firebase:", err);
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
