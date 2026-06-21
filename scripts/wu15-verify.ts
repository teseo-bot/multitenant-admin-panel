// WU-15 verificación: listAuditEvents (endpoint GET /api/admin/audit) contra local.
//   node_modules/.bin/tsx scripts/wu15-verify.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

let pass = 0, fail = 0;
const assert = (n: string, c: boolean, e?: unknown) =>
  c ? (pass++, console.log("  ✓", n)) : (fail++, console.error("  ✗", n, e !== undefined ? JSON.stringify(e) : ""));

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) { console.error("ABORT: no local"); process.exit(1); }
  const { pool } = await import("@/lib/db");
  const { setTenantModules } = await import("@/lib/services/modules");
  const { listAuditEvents } = await import("@/lib/services/audit");

  const actor = (await pool.query(`SELECT id FROM auth.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
  let t = "";
  try {
    t = (await pool.query(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, ["wu15"])).rows[0].id;
    await setTenantModules(t, [{ moduleId: "crm", isActive: true }], actor); // escribe 'tenant_module_change'

    const byTenant = await listAuditEvents({ tenantId: t });
    assert("lista por tenant devuelve >=1", byTenant.length >= 1, byTenant.length);
    assert("evento más reciente es tenant_module_change", byTenant[0]?.action === "tenant_module_change", byTenant[0]?.action);

    const byAction = await listAuditEvents({ tenantId: t, action: "tenant_module_change" });
    assert("filtro action funciona", byAction.length >= 1 && byAction.every(e => e.action === "tenant_module_change"), byAction.map(e => e.action));

    const none = await listAuditEvents({ tenantId: t, action: "no_existe" });
    assert("filtro action sin match => 0", none.length === 0, none.length);
  } finally {
    if (t) {
      await pool.query(`DELETE FROM public.user_management_audit WHERE tenant_id=$1`, [t]);
      await pool.query(`DELETE FROM public.tenants WHERE id=$1`, [t]);
    }
    await pool.end();
  }
  console.log(`\nWU-15: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
