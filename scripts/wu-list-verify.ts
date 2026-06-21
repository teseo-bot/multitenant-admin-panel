// Verificación de listMemberships (endpoint GET /api/admin/memberships) sobre el seed demo.
//   node_modules/.bin/tsx scripts/wu-list-verify.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

let pass = 0, fail = 0;
const assert = (n: string, c: boolean, e?: unknown) =>
  c ? (pass++, console.log("  ✓", n)) : (fail++, console.error("  ✗", n, e !== undefined ? JSON.stringify(e) : ""));

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) { console.error("ABORT: no local"); process.exit(1); }
  const { pool } = await import("@/lib/db");
  const { listMemberships } = await import("@/lib/services/membership");

  const acme = (await pool.query(`SELECT id FROM public.tenants WHERE name='Acme Corp (demo)' LIMIT 1`)).rows[0]?.id;
  if (!acme) { console.error("ABORT: corre seed-ui-demo primero"); process.exit(1); }

  const all = await listMemberships({ tenantId: acme });
  assert("Acme tiene 4 miembros", all.length === 4, all.length);

  const admins = await listMemberships({ tenantId: acme, role: "ADMIN" });
  assert("filtro role=ADMIN => 1 (bob)", admins.length === 1 && admins[0].email === "bob@demo.teseo", admins.map(m => m.email));

  const suspended = await listMemberships({ tenantId: acme, status: "suspended" });
  assert("filtro status=suspended => 1 (dave)", suspended.length === 1 && suspended[0].email === "dave@demo.teseo", suspended.map(m => m.email));

  const q = await listMemberships({ tenantId: acme, q: "carol" });
  assert("filtro q=carol => 1", q.length === 1 && q[0].email === "carol@demo.teseo", q.map(m => m.email));

  const byModule = await listMemberships({ tenantId: acme, moduleId: "analytics" });
  const emails = byModule.map(m => m.email).sort();
  assert("filtro moduleId=analytics => OWNER+ADMIN implícito + grant explícito (3)",
    byModule.length === 3 && JSON.stringify(emails) === JSON.stringify(["alice@demo.teseo", "bob@demo.teseo", "carol@demo.teseo"]),
    emails);

  await pool.end();
  console.log(`\nLIST: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
