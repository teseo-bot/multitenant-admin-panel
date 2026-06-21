// WU-10 verificación (zero-trust) contra Supabase + DB LOCAL.
//   node_modules/.bin/tsx scripts/wu10-verify.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { randomUUID } from "crypto";

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.error("  ✗", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}
async function assertThrows(name: string, fn: () => Promise<unknown>) {
  try { await fn(); assert(name + " (debió lanzar)", false); }
  catch { assert(name, true); }
}

(async () => {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!/127\.0\.0\.1|localhost/.test(supaUrl) || !/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) {
    console.error("ABORT: entorno no es local"); process.exit(1);
  }
  const { pool } = await import("@/lib/db");
  const { inviteAndProvision, acceptInvitation } = await import("@/lib/services/invitations");
  const { getSupabaseAdmin, findUserByEmail } = await import("@/lib/supabase/admin");
  const { resolveAccess } = await import("@/lib/services/membership");
  const admin = getSupabaseAdmin();

  const inviter = (await pool.query(`SELECT id FROM auth.users ORDER BY created_at LIMIT 1`)).rows[0]?.id;
  if (!inviter) { console.error("ABORT: no hay auth.users"); process.exit(1); }

  const stamp = Date.now();
  const email = `wu10-${stamp}@local.test`;
  const email2 = `wu10b-${stamp}@local.test`;
  const fakeTenant = randomUUID();
  let tenantId = "";
  const createdUserIds: string[] = [];
  try {
    tenantId = (await pool.query(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, ["wu10"])).rows[0].id;
    await pool.query(`INSERT INTO public.tenant_modules (tenant_id, module_id, is_active) VALUES ($1,'crm',true)`, [tenantId]);

    // 1) Happy path: identidad + membresía + invitación + auditoría
    const r = await inviteAndProvision({ tenantId, email, role: "ADMIN", invitedBy: inviter });
    createdUserIds.push(r.userId);
    const mem = await pool.query(
      `SELECT role, status FROM public.tenant_users WHERE tenant_id=$1 AND user_id=$2`, [tenantId, r.userId]);
    assert("membresía creada (ADMIN/active)", mem.rows[0]?.role === "ADMIN" && mem.rows[0]?.status === "active", mem.rows[0]);
    const inv = await pool.query(
      `SELECT token, status FROM public.tenant_invitations WHERE tenant_id=$1 AND email=$2`, [tenantId, email]);
    assert("invitación pending", inv.rows[0]?.status === "pending", inv.rows[0]?.status);
    const acc = await resolveAccess(r.userId, tenantId);
    assert("ADMIN resuelve crm WRITE", acc.role === "ADMIN" && acc.modules.crm === "WRITE", acc);
    const au = await pool.query(
      `SELECT count(*)::int n FROM public.user_management_audit WHERE tenant_id=$1 AND action='invite'`, [tenantId]);
    assert("auditoría invite", au.rows[0].n >= 1, au.rows[0].n);

    // 2) Defensa: email que no corresponde => rechazado
    await assertThrows("accept rechaza email no coincidente",
      () => acceptInvitation(inv.rows[0].token, { id: r.userId, email: "otro@x.test" }));

    // 3) Accept correcto => invitación accepted
    await acceptInvitation(inv.rows[0].token, { id: r.userId, email });
    const inv2 = await pool.query(`SELECT status FROM public.tenant_invitations WHERE tenant_id=$1 AND email=$2`, [tenantId, email]);
    assert("invitación accepted tras aceptar", inv2.rows[0]?.status === "accepted", inv2.rows[0]?.status);

    // 4) Propiedad crítica: Auth ok / DB falla (tenant inexistente) => SIN membresía huérfana
    await assertThrows("inviteAndProvision falla con tenant inexistente",
      () => inviteAndProvision({ tenantId: fakeTenant, email: email2, role: "MEMBER", invitedBy: inviter }));
    const u2 = await findUserByEmail(email2);
    if (u2) createdUserIds.push(u2.id); // la identidad Auth sí pudo crearse (inocua)
    const orphan = await pool.query(`SELECT count(*)::int n FROM public.tenant_users WHERE tenant_id=$1`, [fakeTenant]);
    assert("NO queda membresía huérfana tras fallo de DB", orphan.rows[0].n === 0, orphan.rows[0].n);
  } finally {
    if (tenantId) {
      await pool.query(`DELETE FROM public.user_management_audit WHERE tenant_id=$1`, [tenantId]);
      await pool.query(`DELETE FROM public.tenants WHERE id=$1`, [tenantId]);
    }
    for (const id of createdUserIds) { try { await admin.auth.admin.deleteUser(id); } catch {} }
    await pool.end();
  }

  console.log(`\nWU-10: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
