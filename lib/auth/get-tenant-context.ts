// lib/auth/get-tenant-context.ts · G2-W1: contexto de tenant sobre Identity Platform.
// Identidad desde Bearer idToken (SSE/API) o cookie de sesión __session. Sin Supabase.
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/gcp-auth/admin';
import { verifySession, SESSION_COOKIE } from '@/lib/gcp-auth/session';
import { pool } from '@/lib/db';

export type TenantContextResult =
  | { ok: true; ctx: { user: { id: string; email: string | null }; tenantId: string } }
  | { ok: false; err: { error: string; status: number } };

export async function getTenantContext(request: Request): Promise<TenantContextResult> {
  const bearer = request.headers.get('Authorization')?.replace('Bearer ', '');
  let uid: string | null = null;
  let email: string | null = null;
  let claimTenantId: string | undefined;

  try {
    if (bearer) {
      const decoded = await adminAuth().verifyIdToken(bearer);
      uid = decoded.uid;
      email = decoded.email ?? null;
      claimTenantId = decoded.tenant_id as string | undefined;
    } else {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
      const decoded = sessionCookie ? await verifySession(sessionCookie) : null;
      if (decoded) {
        uid = decoded.uid;
        email = decoded.email ?? null;
        claimTenantId = decoded.tenant_id as string | undefined;
      }
    }
  } catch (err) {
    console.error('SSE/API Auth error:', err);
  }

  if (!uid) {
    return { ok: false, err: { error: 'Unauthorized', status: 401 } };
  }

  let tenantId = claimTenantId;
  if (!tenantId) {
    // Fallback: tenant_users (uid TEXT).
    const res = await pool.query(
      'SELECT tenant_id FROM tenant_users WHERE user_id = $1 LIMIT 1',
      [uid]
    );
    if (res.rows[0]) tenantId = res.rows[0].tenant_id as string;
  }

  if (!tenantId) {
    return { ok: false, err: { error: 'Tenant ID missing', status: 400 } };
  }

  return { ok: true, ctx: { user: { id: uid, email }, tenantId } };
}
