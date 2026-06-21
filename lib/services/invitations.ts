// lib/services/invitations.ts
// WU-10 (E4): Flujo de invitación con consistencia entre DOS sistemas
// (Supabase Auth + Cloud SQL). Orden: Auth primero (crea/recupera identidad),
// luego membresía+invitación en UNA transacción DB. Si la DB falla, se hace
// ROLLBACK => NO queda membresía huérfana (la identidad Auth puede quedar sin
// membresía, lo cual es inocuo: sin membresía = sin acceso, ver WU-00).

import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSupabaseAdmin, findUserByEmail } from "@/lib/supabase/admin";
import type { Role } from "@/lib/services/membership";

export interface InviteResult {
  invitationId: string;
  userId: string;
  membershipId: string;
  reusedIdentity: boolean;
}

const ALREADY_EXISTS = /already.*regist|already.*exist|exists/i;

/**
 * Invita y aprovisiona: asegura la identidad en Supabase y crea la membresía.
 * Idempotente respecto a una identidad ya existente (la reutiliza).
 */
export async function inviteAndProvision(input: {
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
  fullName?: string;
}): Promise<InviteResult> {
  const admin = getSupabaseAdmin();

  // 1) Identidad (Auth primero). inviteUserByEmail crea el usuario y envía email.
  let userId: string;
  let reusedIdentity = false;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: input.fullName ? { full_name: input.fullName } : undefined,
  });
  if (error) {
    if (ALREADY_EXISTS.test(error.message)) {
      const existing = await findUserByEmail(input.email);
      if (!existing) throw error;
      userId = existing.id;
      reusedIdentity = true;
    } else {
      throw error;
    }
  } else {
    userId = data.user.id;
  }

  // 2) Membresía + invitación + auditoría, atómico en DB.
  const token = randomUUID().replace(/-/g, "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mem = await client.query(
      `INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
       RETURNING id`,
      [input.tenantId, userId, input.role, input.email]
    );
    const inv = await client.query(
      `INSERT INTO public.tenant_invitations (tenant_id, email, role, invited_by, token, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (tenant_id, email)
         DO UPDATE SET role = EXCLUDED.role, token = EXCLUDED.token,
                       status = 'pending', expires_at = now() + interval '7 days'
       RETURNING id`,
      [input.tenantId, input.email, input.role, input.invitedBy, token]
    );
    await client.query(
      `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
       VALUES ($1, $2, $3, 'invite', $4)`,
      [input.invitedBy, input.tenantId, userId, JSON.stringify({ email: input.email, role: input.role, reusedIdentity })]
    );
    await client.query("COMMIT");
    return { invitationId: inv.rows[0].id, userId, membershipId: mem.rows[0].id, reusedIdentity };
  } catch (err) {
    await client.query("ROLLBACK");
    // Compensación: la identidad Auth queda, pero SIN membresía. No hay membresía huérfana.
    logger.error("invitations.inviteAndProvision.db_failed", {
      error: String(err),
      email: input.email,
      tenantId: input.tenantId,
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Acepta una invitación por token: valida estado/expiración, marca aceptada y
 * asegura la membresía activa. Idempotente sobre la membresía.
 */
export async function acceptInvitation(
  token: string,
  caller: { id: string; email: string }
): Promise<{ tenantId: string; userId: string }> {
  const { rows } = await pool.query(
    `SELECT * FROM public.tenant_invitations WHERE token = $1`,
    [token]
  );
  const inv = rows[0];
  if (!inv) throw new Error("Invitación no encontrada");
  // Defensa: sólo el invitado (por email) puede aceptar su invitación.
  if (inv.email.toLowerCase() !== caller.email.toLowerCase()) {
    throw new Error("La invitación no corresponde al usuario autenticado");
  }
  if (inv.status === "accepted") throw new Error("Invitación ya aceptada");
  if (inv.status !== "pending") throw new Error(`Invitación ${inv.status}`);
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    await pool.query(`UPDATE public.tenant_invitations SET status = 'expired' WHERE id = $1`, [inv.id]);
    throw new Error("Invitación expirada");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET status = 'active', updated_at = now()`,
      [inv.tenant_id, caller.id, inv.role, inv.email]
    );
    await client.query(`UPDATE public.tenant_invitations SET status = 'accepted' WHERE id = $1`, [inv.id]);
    await client.query(
      `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
       VALUES ($1, $2, $3, 'invite_accepted', $4)`,
      [caller.id, inv.tenant_id, caller.id, JSON.stringify({ invitationId: inv.id })]
    );
    await client.query("COMMIT");
    return { tenantId: inv.tenant_id, userId: caller.id };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("invitations.acceptInvitation.error", { error: String(err), token });
    throw err;
  } finally {
    client.release();
  }
}

/** Reenvía la invitación (re-dispara el email y renueva la expiración). */
export async function resendInvitation(invitationId: string, actor: string): Promise<void> {
  const { rows } = await pool.query(`SELECT * FROM public.tenant_invitations WHERE id = $1`, [invitationId]);
  const inv = rows[0];
  if (!inv) throw new Error("Invitación no encontrada");

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.inviteUserByEmail(inv.email);
  if (error && !ALREADY_EXISTS.test(error.message)) throw error;

  await pool.query(
    `UPDATE public.tenant_invitations
     SET status = 'pending', expires_at = now() + interval '7 days'
     WHERE id = $1`,
    [invitationId]
  );
  await pool.query(
    `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
     VALUES ($1, $2, NULL, 'invite_resent', $3)`,
    [actor, inv.tenant_id, JSON.stringify({ invitationId })]
  );
}
