// lib/services/membership.ts
// WU-05 (E2): Servicio de dominio de membresías. FUENTE ÚNICA DE ESCRITURA.
// Toda mutación de membresía/rol/módulo/invitación pasa por aquí y deja auditoría.
// No contiene lógica de identidad (auth.users): inviteUser sólo crea la invitación;
// la creación de la cuenta de Supabase la orquesta WU-10.

import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Tipos del contrato
// ---------------------------------------------------------------------------
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type AccessLevel = "NONE" | "READ" | "WRITE";
export type MembershipStatus = "active" | "suspended";

export interface Membership {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: Role;
  status: MembershipStatus;
  lastActive: string | null;
  tokenUsage: number;
  createdAt: string;
}

export interface Invitation {
  id: string;
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string | null;
  token: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface ModuleGrant {
  moduleId: string;
  level: AccessLevel;
}

export interface ResolvedAccess {
  role: Role | null;
  modules: Record<string, "READ" | "WRITE">;
}

export interface MembershipFilter {
  tenantId?: string;
  role?: Role;
  moduleId?: string;
  status?: MembershipStatus;
  q?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const IMPLICIT_ALL_ROLES: Role[] = ["OWNER", "ADMIN"];

function mapMembership(r: any): Membership {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name ?? null,
    userId: r.user_id ?? null,
    email: r.email ?? null,
    fullName: r.full_name ?? null,
    role: (r.role ?? "MEMBER") as Role,
    status: (r.status ?? "active") as MembershipStatus,
    lastActive: r.last_active ? new Date(r.last_active).toISOString() : null,
    tokenUsage: r.token_usage ?? 0,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** Inserta una fila de auditoría. Reusa el client de una transacción si se pasa. */
async function audit(
  exec: PoolClient | typeof pool,
  entry: {
    actorId?: string | null;
    tenantId?: string | null;
    targetUser?: string | null;
    action: string;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await exec.query(
    `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      entry.actorId ?? null,
      entry.tenantId ?? null,
      entry.targetUser ?? null,
      entry.action,
      entry.detail ? JSON.stringify(entry.detail) : null,
    ]
  );
}

/** Carga (tenant_id, user_id, role) de una membresía para auditar el target. */
async function loadMembershipMeta(
  exec: PoolClient | typeof pool,
  id: string
): Promise<{ tenant_id: string; user_id: string | null } | null> {
  const { rows } = await exec.query(
    `SELECT tenant_id, user_id FROM public.tenant_users WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------
export async function listMemberships(filter: MembershipFilter = {}): Promise<Membership[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`tu.tenant_id = $${params.length}`);
  }
  if (filter.role) {
    params.push(filter.role);
    where.push(`tu.role = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    where.push(`tu.status = $${params.length}`);
  }
  if (filter.q) {
    params.push(`%${filter.q}%`);
    where.push(`(tu.email ILIKE $${params.length} OR tu.full_name ILIKE $${params.length})`);
  }
  if (filter.moduleId) {
    // Acceso al módulo: explícito (tenant_user_modules) o implícito (OWNER/ADMIN
    // con el módulo activo en el tenant).
    params.push(filter.moduleId);
    const p = params.length;
    where.push(`(
      EXISTS (
        SELECT 1 FROM public.tenant_user_modules tum
        WHERE tum.tenant_user_id = tu.id AND tum.module_id = $${p}
          AND tum.access_level <> 'NONE'
      )
      OR (
        tu.role IN ('OWNER','ADMIN')
        AND EXISTS (
          SELECT 1 FROM public.tenant_modules tm
          WHERE tm.tenant_id = tu.tenant_id AND tm.module_id = $${p} AND tm.is_active = true
        )
      )
    )`);
  }

  const sql = `
    SELECT tu.id, tu.tenant_id, tu.user_id, tu.email, tu.full_name, tu.role,
           tu.status, tu.last_active, tu.token_usage, tu.created_at,
           t.name AS tenant_name
    FROM public.tenant_users tu
    LEFT JOIN public.tenants t ON t.id = tu.tenant_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY tu.created_at DESC`;

  const { rows } = await pool.query(sql, params);
  return rows.map(mapMembership);
}

/** Grants de módulo explícitos de una membresía (para editar en la UI). */
export async function getMembershipGrants(id: string): Promise<ModuleGrant[]> {
  const { rows } = await pool.query(
    `SELECT module_id, access_level FROM public.tenant_user_modules
     WHERE tenant_user_id = $1 AND access_level <> 'NONE'`,
    [id]
  );
  return rows.map((r: any) => ({ moduleId: r.module_id, level: r.access_level as AccessLevel }));
}

export async function getMembership(id: string): Promise<Membership | null> {
  const { rows } = await pool.query(
    `SELECT tu.id, tu.tenant_id, tu.user_id, tu.email, tu.full_name, tu.role,
            tu.status, tu.last_active, tu.token_usage, tu.created_at,
            t.name AS tenant_name
     FROM public.tenant_users tu
     LEFT JOIN public.tenants t ON t.id = tu.tenant_id
     WHERE tu.id = $1`,
    [id]
  );
  return rows[0] ? mapMembership(rows[0]) : null;
}

/**
 * Resuelve el acceso efectivo de un usuario en un tenant (regla §3.4):
 *  - OWNER/ADMIN  => todos los módulos ACTIVOS del tenant, nivel WRITE.
 *  - MEMBER/VIEWER => sólo tenant_user_modules con nivel READ/WRITE, acotado a
 *    módulos activos del tenant.
 *  - Sin membresía activa => { role: null, modules: {} } (SIN acceso).
 */
export async function resolveAccess(userId: string, tenantId: string): Promise<ResolvedAccess> {
  const { rows } = await pool.query(
    `SELECT id, role, status FROM public.tenant_users
     WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );
  const m = rows[0];
  if (!m || m.status !== "active") {
    return { role: null, modules: {} };
  }

  const role = m.role as Role;
  const modules: Record<string, "READ" | "WRITE"> = {};

  if (IMPLICIT_ALL_ROLES.includes(role)) {
    const r = await pool.query(
      `SELECT module_id FROM public.tenant_modules
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );
    for (const row of r.rows) modules[row.module_id] = "WRITE";
    return { role, modules };
  }

  const r = await pool.query(
    `SELECT tum.module_id, tum.access_level
     FROM public.tenant_user_modules tum
     JOIN public.tenant_modules tm
       ON tm.tenant_id = $2 AND tm.module_id = tum.module_id AND tm.is_active = true
     WHERE tum.tenant_user_id = $1 AND tum.access_level IN ('READ','WRITE')`,
    [m.id, tenantId]
  );
  for (const row of r.rows) modules[row.module_id] = row.access_level as "READ" | "WRITE";
  return { role, modules };
}

// ---------------------------------------------------------------------------
// Mutaciones (cada una deja auditoría)
// ---------------------------------------------------------------------------

/** Crea una invitación pendiente. NO crea identidad en auth.users (eso es WU-10). */
export async function inviteUser(input: {
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
}): Promise<Invitation> {
  const token = randomUUID().replace(/-/g, "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO public.tenant_invitations (tenant_id, email, role, invited_by, token, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, tenant_id, email, role, invited_by, token, status, expires_at, created_at`,
      [input.tenantId, input.email, input.role, input.invitedBy, token]
    );
    await audit(client, {
      actorId: input.invitedBy,
      tenantId: input.tenantId,
      action: "invite",
      detail: { email: input.email, role: input.role },
    });
    await client.query("COMMIT");
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      email: r.email,
      role: r.role as Role,
      invitedBy: r.invited_by ?? null,
      token: r.token,
      status: r.status,
      expiresAt: new Date(r.expires_at).toISOString(),
      createdAt: new Date(r.created_at).toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("membership.inviteUser.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

export async function setRole(id: string, role: Role, actor: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meta = await loadMembershipMeta(client, id);
    if (!meta) throw new Error(`Membership ${id} not found`);
    await client.query(`UPDATE public.tenant_users SET role = $1, updated_at = now() WHERE id = $2`, [role, id]);
    await audit(client, {
      actorId: actor,
      tenantId: meta.tenant_id,
      targetUser: meta.user_id,
      action: "role_change",
      detail: { membershipId: id, role },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("membership.setRole.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

export async function setModuleAccess(id: string, grants: ModuleGrant[], actor: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meta = await loadMembershipMeta(client, id);
    if (!meta) throw new Error(`Membership ${id} not found`);
    for (const g of grants) {
      await client.query(
        `INSERT INTO public.tenant_user_modules (tenant_user_id, module_id, access_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_user_id, module_id) DO UPDATE SET access_level = EXCLUDED.access_level`,
        [id, g.moduleId, g.level]
      );
    }
    await audit(client, {
      actorId: actor,
      tenantId: meta.tenant_id,
      targetUser: meta.user_id,
      action: "module_grant",
      detail: { membershipId: id, grants },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("membership.setModuleAccess.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

export async function suspend(id: string, actor: string): Promise<void> {
  await mutateStatus(id, "suspended", "suspend", actor);
}

export async function reactivate(id: string, actor: string): Promise<void> {
  await mutateStatus(id, "active", "reactivate", actor);
}

async function mutateStatus(
  id: string,
  status: MembershipStatus,
  action: string,
  actor: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meta = await loadMembershipMeta(client, id);
    if (!meta) throw new Error(`Membership ${id} not found`);
    await client.query(`UPDATE public.tenant_users SET status = $1, updated_at = now() WHERE id = $2`, [status, id]);
    await audit(client, {
      actorId: actor,
      tenantId: meta.tenant_id,
      targetUser: meta.user_id,
      action,
      detail: { membershipId: id, status },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("membership.mutateStatus.error", { error: String(err), action });
    throw err;
  } finally {
    client.release();
  }
}

export async function removeMembership(id: string, actor: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meta = await loadMembershipMeta(client, id);
    if (!meta) throw new Error(`Membership ${id} not found`);
    await client.query(`DELETE FROM public.tenant_users WHERE id = $1`, [id]);
    await audit(client, {
      actorId: actor,
      tenantId: meta.tenant_id,
      targetUser: meta.user_id,
      action: "delete",
      detail: { membershipId: id },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("membership.removeMembership.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}
