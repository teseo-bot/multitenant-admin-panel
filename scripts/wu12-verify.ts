// WU-12 verificación: entitlements de módulos por tenant (servicio) contra local.
//   node_modules/.bin/tsx scripts/wu12-verify.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

let pass = 0, fail = 0;
const assert = (n: string, c: boolean, e?: unknown) =>
  c ? (pass++, console.log("  ✓", n)) : (fail++, console.error("  ✗", n, e !== undefined ? JSON.stringify(e) : ""));

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) { console.error("ABORT: no local"); process.exit(1); }
  const { pool } = await import("@/lib/db");
  const { listTenantModules, setTenantModules } = await import("@/lib/services/modules");
  const { resolveAccess } = await import("@/lib/services/membership");

  const actor = (await pool.query(`SELECT id FROM auth.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
  let t = "";
  try {
    t = (await pool.query(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, ["wu12"])).rows[0].id;
    await pool.query(`INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email) VALUES ($1,$2,'OWNER','active','o@l')`, [t, actor]);

    // Activar crm + analytics
    await setTenantModules(t, [{ moduleId: "crm", isActive: true }, { moduleId: "analytics", isActive: true }], actor);
    let list = await listTenantModules(t);
    const crm = list.find((m) => m.moduleId === "crm");
    assert("crm activo en lista", crm?.isActive === true, crm);
    let acc = await resolveAccess(actor, t);
    assert("OWNER ve crm+analytics", acc.modules.crm === "WRITE" && acc.modules.analytics === "WRITE", acc.modules);

    // Desactivar analytics => desaparece de resolveAccess y queda isActive=false en lista
    await setTenantModules(t, [{ moduleId: "analytics", isActive: false }], actor);
    list = await listTenantModules(t);
    assert("analytics isActive=false en lista", list.find((m) => m.moduleId === "analytics")?.isActive === false);
    acc = await resolveAccess(actor, t);
    assert("desactivar => analytics ya NO en resolveAccess", acc.modules.analytics === undefined, acc.modules);
    assert("crm sigue activo", acc.modules.crm === "WRITE", acc.modules);

    const au = await pool.query(`SELECT count(*)::int n FROM public.user_management_audit WHERE tenant_id=$1 AND action='tenant_module_change'`, [t]);
    assert("auditoría tenant_module_change", au.rows[0].n >= 1, au.rows[0].n);
  } finally {
    if (t) {
      await pool.query(`DELETE FROM public.user_management_audit WHERE tenant_id=$1`, [t]);
      await pool.query(`DELETE FROM public.tenants WHERE id=$1`, [t]);
    }
    await pool.end();
  }
  console.log(`\nWU-12: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
