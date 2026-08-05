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
import { authForTenantProject } from "@/lib/tenants/tenant-idp";
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
/**
 * Dominio al que apunta el enlace de contraseña. ADR-212 D1: debe ser el del TENANT, porque es
 * el panel donde el usuario va a trabajar y donde su identidad existe. Si el tenant no está
 * migrado (sin IdP propio) el enlace lo consume control, así que se usa APP_URL.
 */
async function resolveTenantLoginUrl(tenantId: string, esDelTenant: boolean): Promise<string> {
  const fallback = process.env.APP_URL || "http://localhost:3000";
  if (!esDelTenant) return fallback;
  const { rows } = await pool.query("SELECT domain FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
  const domain = rows[0]?.domain;
  if (!domain) {
    // Sin dominio no se inventa uno: se cae a control y se registra. Un enlace a un dominio
    // equivocado es peor que un enlace al panel de control.
    logger.warn("invitations.tenantDomain.missing", { tenantId });
    return fallback;
  }
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

export async function inviteAndProvision(input: {
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
  fullName?: string;
}): Promise<InviteResult> {
  // 1) Identidad (Auth primero): createUser o reutiliza si ya existe.
  //
  // ADR-212 D1: la identidad va al IdP DEL TENANT, no al de control. Antes esto usaba
  // `adminAuth()`, que resuelve applicationDefault() sin projectId y creaba al usuario en
  // micontexto-control — donde el panel del tenant NO puede autenticarlo, porque los tokens de
  // Firebase son por proyecto. Medido con la primera alta real: monica.galan@fleetco.mx quedó
  // en control, sin contraseña y sin claims, y no existía en micontexto-tenant1.
  //
  // Si el tenant no tiene mapa de IdP, `authForTenantProject` cae al de control y el
  // comportamiento es el anterior — fallback deliberado para no romper tenants sin migrar.
  const { auth: tenantAuth, esDelTenant, idpProjectId } = await authForTenantProject(input.tenantId);

  let userId: string;
  let reusedIdentity = false;
  let userWasCreated = false;

  try {
    const user = await tenantAuth.createUser({
      email: input.email,
      ...(input.fullName && { displayName: input.fullName }),
    });
    userId = user.uid;
    userWasCreated = true;
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      const existing = await tenantAuth.getUserByEmail(input.email);
      userId = existing.uid;
      reusedIdentity = true;
    } else {
      throw err;
    }
  }

  // 1b) Claims: el panel del tenant gatea por el claim `tenant_id` (getTenantContext).
  // Sin esto el usuario entra y no ve nada. Falla no-bloqueante: existe el fallback por
  // tenant_users, pero se registra — que el claim falte no debe pasar inadvertido.
  if (esDelTenant) {
    try {
      await tenantAuth.setCustomUserClaims(userId, { tenant_id: input.tenantId, role: input.role });
    } catch (err) {
      logger.error('invitations.setCustomUserClaims.failed', {
        error: String(err), userId, tenantId: input.tenantId,
      });
    }
  }

  // 2) Generar password reset link y enviar correo.
  //
  // El continueUrl DEBE ser el dominio del tenant, no el de control: el enlace lo consume el
  // panel donde el usuario va a trabajar, y ese dominio ya está en los autorizados de tenant1.
  // Apuntarlo a control mandaría al usuario a un panel donde su identidad no existe.
  const continueUrl = `${await resolveTenantLoginUrl(input.tenantId, esDelTenant)}/auth/login`;
  let passwordResetLink: string;
  try {
    passwordResetLink = await tenantAuth.generatePasswordResetLink(input.email, {
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
        // La compensación borra en el MISMO IdP donde se creó, no en el de control.
        await tenantAuth.deleteUser(userId);
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
        await tenantAuth.deleteUser(userId);
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
        await tenantAuth.deleteUser(userId);
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
