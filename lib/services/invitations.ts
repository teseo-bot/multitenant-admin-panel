// lib/services/invitations.ts
// WU-10 (E4): Flujo de invitación con consistencia entre DOS sistemas
// (Firebase Identity Platform + Cloud SQL). Orden: Auth primero (crea/recupera identidad),
// luego membresía+invitación en UNA transacción DB. Si la DB falla, se hace
// ROLLBACK => NO queda membresía huérfana (la identidad Auth puede quedar sin
// membresía, lo cual es inocuo: sin membresía = sin acceso, ver WU-00).

import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { adminAuth } from "@/lib/gcp-auth/admin";
import { sendMail } from "@/lib/mailer";
import type { Role } from "@/lib/services/membership";

export interface InviteResult {
  invitationId: string;
  userId: string;
  membershipId: string;
  reusedIdentity: boolean;
}


/**
 * Invita y aprovisiona: asegura la identidad en Firebase Identity Platform y crea la membresía.
 * Idempotente respecto a una identidad ya existente (la reutiliza).
 *
 * Invariante INV-G2: si DB falla y userWasCreated=true, se ejecuta deleteUser(uid) en compensación.
 */
export async function inviteAndProvision(input: {
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
  fullName?: string;
}): Promise<InviteResult> {
  // 1) Identidad (Auth primero): createUser o reutiliza si ya existe.
  let userId: string;
  let reusedIdentity = false;
  let userWasCreated = false;

  try {
    const user = await adminAuth().createUser({
      email: input.email,
      ...(input.fullName && { displayName: input.fullName }),
    });
    userId = user.uid;
    userWasCreated = true;
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await adminAuth().getUserByEmail(input.email);
      userId = existing.uid;
      reusedIdentity = true;
    } else {
      throw err;
    }
  }

  // 2) Generar password reset link y enviar correo.
  const continueUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`;
  let passwordResetLink: string;
  try {
    passwordResetLink = await adminAuth().generatePasswordResetLink(input.email, {
      url: continueUrl,
    });
  } catch (err) {
    logger.error("invitations.generatePasswordResetLink.failed", {
      error: String(err),
      email: input.email,
    });
    // Si falla generar el link pero el usuario acaba de ser creado, compensar.
    if (userWasCreated) {
      try {
        await adminAuth().deleteUser(userId);
      } catch (delErr) {
        logger.error("invitations.deleteUser.failed_after_link_error", { error: String(delErr), userId });
      }
    }
    throw err;
  }

  // Envía correo de invitación (P-G2).
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>¡Hola!</p>
  <p>Has sido invitado por <strong>${input.invitedBy}</strong> a unirte con el rol <strong>${input.role}</strong>.</p>
  <p>
    <a href="${passwordResetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
      Crear contraseña
    </a>
  </p>
  <p style="font-size: 0.9em; color: #666;">
    Este enlace vence en 7 días. Si no esperabas este correo, ignóralo.
  </p>
</body>
</html>
`;

  try {
    await sendMail({
      to: input.email,
      subject: `Tu acceso a ${process.env.PANEL_NAME || 'nuestro panel'}`,
      html: htmlBody,
    });
  } catch (err) {
    logger.error("invitations.sendMail.failed", {
      error: String(err),
      email: input.email,
    });
    // Si falla enviar el correo pero el usuario acaba de ser creado, compensar.
    if (userWasCreated) {
      try {
        await adminAuth().deleteUser(userId);
      } catch (delErr) {
        logger.error("invitations.deleteUser.failed_after_mail_error", { error: String(delErr), userId });
      }
    }
    throw err;
  }

  // 3) Membresía + invitación + auditoría, atómico en DB.
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
    // Compensación INV-G2.1/G2.2: eliminar el usuario SOLO si acaba de ser creado.
    if (userWasCreated) {
      try {
        await adminAuth().deleteUser(userId);
        logger.info("invitations.deleteUser.compensated", { userId, email: input.email });
      } catch (delErr) {
        logger.error("invitations.deleteUser.failed_after_db_error", {
          error: String(delErr),
          userId,
          email: input.email,
        });
      }
    }
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

  // Generar nuevo link de password reset y reenviar correo.
  const continueUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`;
  const passwordResetLink = await adminAuth().generatePasswordResetLink(inv.email, {
    url: continueUrl,
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>¡Hola!</p>
  <p>Te reenviamos tu invitación para unirte con el rol <strong>${inv.role}</strong>.</p>
  <p>
    <a href="${passwordResetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
      Crear contraseña
    </a>
  </p>
  <p style="font-size: 0.9em; color: #666;">
    Este enlace vence en 7 días. Si no esperabas este correo, ignóralo.
  </p>
</body>
</html>
`;

  await sendMail({
    to: inv.email,
    subject: `Tu acceso a ${process.env.PANEL_NAME || 'nuestro panel'} (reenvío)`,
    html: htmlBody,
  });

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
