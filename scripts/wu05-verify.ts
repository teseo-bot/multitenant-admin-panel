// WU-05 verificación (zero-trust) ejecutable con tsx contra la DB LOCAL.
// Importa el servicio REAL y valida los 4 criterios de aceptación.
//   node_modules/.bin/tsx scripts/wu05-verify.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ACTOR = "00000000-0000-0000-0000-000000000000";
let pass = 0, fail = 0;
function assert(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.error("  ✗", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) {
    console.error("ABORT: DATABASE_URL no es local"); process.exit(1);
  }
  // Imports dinámicos: DESPUÉS de cargar .env.local (lib/db crea el pool al evaluarse).
  const { pool } = await import("@/lib/db");
  const { resolveAccess, setModuleAccess, setRole } = await import("@/lib/services/membership");

  const newTenant = async (name: string) =>
    (await pool.query(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [name])).rows[0].id as string;
  const activate = async (t: string, m: string, a: boolean) =>
    pool.query(`INSERT INTO public.tenant_modules (tenant_id, module_id, is_active) VALUES ($1,$2,$3)
                ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = EXCLUDED.is_active`, [t, m, a]);
  const member = async (t: string, u: string, role: string) =>
    (await pool.query(`INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email)
                       VALUES ($1,$2,$3,'active','test@local') RETURNING id`, [t, u, role])).rows[0].id as string;

  const u = await pool.query(`SELECT id FROM auth.users ORDER BY created_at LIMIT 1`);
  const userId = u.rows[0]?.id;
  if (!userId) { console.error("ABORT: no hay auth.users en local"); process.exit(1); }

  let tOwner = "", tMember = "";
  try {
    tOwner = await newTenant("wu05-owner");
    await activate(tOwner, "crm", true);
    await activate(tOwner, "analytics", true);
    await activate(tOwner, "compliance", false);
    await member(tOwner, userId, "OWNER");

    tMember = await newTenant("wu05-member");
    await activate(tMember, "crm", true);
    await activate(tMember, "analytics", false);
    const mid = await member(tMember, userId, "MEMBER");

    // 1) OWNER ve todos los módulos ACTIVOS (no inactivos)
    const a1 = await resolveAccess(userId, tOwner);
    assert("OWNER role", a1.role === "OWNER", a1.role);
    assert("OWNER ve crm+analytics WRITE, no compliance",
      JSON.stringify(a1.modules) === JSON.stringify({ crm: "WRITE", analytics: "WRITE" }), a1.modules);

    // 2) MEMBER sin grants ve 0
    const a2 = await resolveAccess(userId, tMember);
    assert("MEMBER role", a2.role === "MEMBER", a2.role);
    assert("MEMBER sin grants => {}", Object.keys(a2.modules).length === 0, a2.modules);

    // 3) grant a módulo inactivo => sin acceso; activo => con acceso
    await setModuleAccess(mid, [{ moduleId: "crm", level: "WRITE" }, { moduleId: "analytics", level: "READ" }], userId);
    const a3 = await resolveAccess(userId, tMember);
    assert("grant a módulo activo (crm) visible", a3.modules.crm === "WRITE", a3.modules);
    assert("grant a módulo inactivo (analytics) NO visible", a3.modules.analytics === undefined, a3.modules);

    // 4) toda mutación deja auditoría
    await setRole(mid, "ADMIN", userId);
    const au = await pool.query(
      `SELECT count(*)::int n FROM public.user_management_audit WHERE tenant_id=$1 AND action='role_change'`, [tMember]);
    assert("setRole dejó auditoría role_change", au.rows[0].n >= 1, au.rows[0].n);
    const au2 = await pool.query(
      `SELECT count(*)::int n FROM public.user_management_audit WHERE tenant_id=$1 AND action='module_grant'`, [tMember]);
    assert("setModuleAccess dejó auditoría module_grant", au2.rows[0].n >= 1, au2.rows[0].n);
  } finally {
    for (const t of [tOwner, tMember].filter(Boolean)) {
      await pool.query(`DELETE FROM public.user_management_audit WHERE tenant_id=$1`, [t]);
      await pool.query(`DELETE FROM public.tenants WHERE id=$1`, [t]);
    }
    await pool.end();
  }

  console.log(`\nWU-05: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
