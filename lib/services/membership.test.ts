// @vitest-environment node
// WU-05: tests de integración del servicio de membresías contra la DB local.
// Cubre los criterios de aceptación: OWNER ve todos los módulos activos;
// MEMBER sin grants ve 0; grant a módulo inactivo => sin acceso; toda mutación audita.
// Guardado: sólo corre contra DATABASE_URL local (127.0.0.1 / localhost).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool } from "@/lib/db";
import {
  resolveAccess,
  setModuleAccess,
  setRole,
} from "@/lib/services/membership";

const isLocal = /127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "");
const d = isLocal ? describe : describe.skip;

async function newTenant(name: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`,
    [name]
  );
  return rows[0].id;
}

async function activateModule(tenantId: string, moduleId: string, active: boolean) {
  await pool.query(
    `INSERT INTO public.tenant_modules (tenant_id, module_id, is_active)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = EXCLUDED.is_active`,
    [tenantId, moduleId, active]
  );
}

async function newMembership(tenantId: string, userId: string, role: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email)
     VALUES ($1, $2, $3, 'active', 'test@local') RETURNING id`,
    [tenantId, userId, role]
  );
  return rows[0].id;
}

d("membership service (integración local)", () => {
  let userId: string;
  let tOwner: string;
  let tMember: string;
  const ACTOR = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    const u = await pool.query(`SELECT id FROM auth.users ORDER BY created_at LIMIT 1`);
    userId = u.rows[0]?.id;
    if (!userId) return;

    tOwner = await newTenant("wu05-owner");
    await activateModule(tOwner, "crm", true);
    await activateModule(tOwner, "analytics", true);
    await activateModule(tOwner, "compliance", false); // inactivo
    await newMembership(tOwner, userId, "OWNER");

    tMember = await newTenant("wu05-member");
    await activateModule(tMember, "crm", true);
    await activateModule(tMember, "analytics", false); // inactivo
    await newMembership(tMember, userId, "MEMBER");
  });

  afterAll(async () => {
    for (const t of [tOwner, tMember].filter(Boolean)) {
      await pool.query(`DELETE FROM public.user_management_audit WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM public.tenants WHERE id = $1`, [t]); // cascada al resto
    }
    await pool.end();
  });

  it("OWNER ve TODOS los módulos activos del tenant (no los inactivos)", async () => {
    const { role, modules } = await resolveAccess(userId, tOwner);
    expect(role).toBe("OWNER");
    expect(modules).toEqual({ crm: "WRITE", analytics: "WRITE" });
    expect(modules.compliance).toBeUndefined();
  });

  it("MEMBER sin grants ve 0 módulos", async () => {
    const { role, modules } = await resolveAccess(userId, tMember);
    expect(role).toBe("MEMBER");
    expect(modules).toEqual({});
  });

  it("grant a módulo INACTIVO del tenant => sin acceso; activo => con acceso", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM public.tenant_users WHERE tenant_id = $1 AND user_id = $2`,
      [tMember, userId]
    );
    const membershipId = rows[0].id;
    await setModuleAccess(
      membershipId,
      [
        { moduleId: "crm", level: "WRITE" },      // crm está activo
        { moduleId: "analytics", level: "READ" }, // analytics está inactivo
      ],
      ACTOR
    );
    const { modules } = await resolveAccess(userId, tMember);
    expect(modules.crm).toBe("WRITE");
    expect(modules.analytics).toBeUndefined(); // inactivo => no aparece
  });

  it("toda mutación deja fila de auditoría", async () => {
    const { rows } = await pool.query(
      `SELECT id FROM public.tenant_users WHERE tenant_id = $1 AND user_id = $2`,
      [tMember, userId]
    );
    const membershipId = rows[0].id;
    await setRole(membershipId, "ADMIN", ACTOR);

    const audit = await pool.query(
      `SELECT action FROM public.user_management_audit
       WHERE tenant_id = $1 AND action = 'role_change'`,
      [tMember]
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });
});
