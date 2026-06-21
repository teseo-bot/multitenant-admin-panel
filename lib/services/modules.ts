// lib/services/modules.ts
// WU-12 (E5): Entitlements de módulos por tenant (tenant_modules). Qué módulos
// tiene activos/contratados un tenant. Escritura con auditoría.

import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface TenantModuleEntitlement {
  moduleId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** Catálogo de módulos con el flag de activación para este tenant. */
export async function listTenantModules(tenantId: string): Promise<TenantModuleEntitlement[]> {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.sort_order, COALESCE(tm.is_active, false) AS is_active
     FROM public.modules m
     LEFT JOIN public.tenant_modules tm ON tm.module_id = m.id AND tm.tenant_id = $1
     WHERE m.is_active = true
     ORDER BY m.sort_order`,
    [tenantId]
  );
  return rows.map((r: any) => ({
    moduleId: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    isActive: r.is_active === true,
  }));
}

/** Activa/desactiva módulos contratados de un tenant (upsert) con auditoría. */
export async function setTenantModules(
  tenantId: string,
  entries: { moduleId: string; isActive: boolean }[],
  actor: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const e of entries) {
      await client.query(
        `INSERT INTO public.tenant_modules (tenant_id, module_id, is_active)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = EXCLUDED.is_active`,
        [tenantId, e.moduleId, e.isActive]
      );
    }
    await client.query(
      `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
       VALUES ($1, $2, NULL, 'tenant_module_change', $3)`,
      [actor, tenantId, JSON.stringify({ entries })]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("modules.setTenantModules.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}
