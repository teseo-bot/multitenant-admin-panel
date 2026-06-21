// scripts/seed-ui-demo.ts
// Seed de datos de demo para verificar la UI de gestión de usuarios.
// LOCAL-ONLY e idempotente. Crea tenants, módulos activos, miembros con roles
// y estados variados, grants de módulo y una invitación pendiente.
// Los usuarios demo pueden iniciar sesión (password DEMO_PASSWORD).
//   node_modules/.bin/tsx scripts/seed-ui-demo.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DEMO_PASSWORD = "Demo1234!";

(async () => {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!/127\.0\.0\.1|localhost/.test(supaUrl) || !/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) {
    console.error("ABORT: entorno no es local"); process.exit(1);
  }
  const { pool } = await import("@/lib/db");
  const { getSupabaseAdmin, findUserByEmail } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdmin();

  async function ensureUser(email: string, fullName: string): Promise<string> {
    const existing = await findUserByEmail(email);
    if (existing) return existing.id;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    return data.user.id;
  }

  async function ensureTenant(name: string): Promise<string> {
    const found = await pool.query(`SELECT id FROM public.tenants WHERE name = $1 LIMIT 1`, [name]);
    if (found.rows[0]) return found.rows[0].id;
    return (await pool.query(`INSERT INTO public.tenants (name) VALUES ($1) RETURNING id`, [name])).rows[0].id;
  }
  const activate = (t: string, m: string, a = true) =>
    pool.query(`INSERT INTO public.tenant_modules (tenant_id, module_id, is_active) VALUES ($1,$2,$3)
                ON CONFLICT (tenant_id, module_id) DO UPDATE SET is_active = EXCLUDED.is_active`, [t, m, a]);
  const membership = (t: string, u: string, role: string, status: string, email: string) =>
    pool.query(`INSERT INTO public.tenant_users (tenant_id, user_id, role, status, email) VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (tenant_id, user_id) DO UPDATE SET role=EXCLUDED.role, status=EXCLUDED.status, email=EXCLUDED.email
                RETURNING id`, [t, u, role, status, email]);
  const grant = (mid: string, m: string, lvl: string) =>
    pool.query(`INSERT INTO public.tenant_user_modules (tenant_user_id, module_id, access_level) VALUES ($1,$2,$3)
                ON CONFLICT (tenant_user_id, module_id) DO UPDATE SET access_level = EXCLUDED.access_level`, [mid, m, lvl]);

  // --- Tenant Acme ---
  const acme = await ensureTenant("Acme Corp (demo)");
  await Promise.all([activate(acme, "crm"), activate(acme, "analytics"), activate(acme, "finops"), activate(acme, "compliance", false)]);
  const alice = await ensureUser("alice@demo.teseo", "Alice Owner");
  const bob = await ensureUser("bob@demo.teseo", "Bob Admin");
  const carol = await ensureUser("carol@demo.teseo", "Carol Member");
  const dave = await ensureUser("dave@demo.teseo", "Dave Viewer");
  await membership(acme, alice, "OWNER", "active", "alice@demo.teseo");
  await membership(acme, bob, "ADMIN", "active", "bob@demo.teseo");
  const carolM = (await membership(acme, carol, "MEMBER", "active", "carol@demo.teseo")).rows[0].id;
  await grant(carolM, "crm", "WRITE");
  await grant(carolM, "analytics", "READ");
  await membership(acme, dave, "VIEWER", "suspended", "dave@demo.teseo");

  // Invitación pendiente (sin membresía)
  await pool.query(
    `INSERT INTO public.tenant_invitations (tenant_id, email, role, token, status)
     VALUES ($1,'eve@demo.teseo','MEMBER',$2,'pending')
     ON CONFLICT (tenant_id, email) DO UPDATE SET status='pending'`,
    [acme, "demo-token-" + acme.slice(0, 8)]
  );

  // --- Tenant Globex ---
  const globex = await ensureTenant("Globex (demo)");
  await Promise.all([activate(globex, "crm"), activate(globex, "lms")]);
  const frank = await ensureUser("frank@demo.teseo", "Frank Owner");
  await membership(globex, frank, "OWNER", "active", "frank@demo.teseo");

  await pool.end();
  console.log("Seed OK.");
  console.log("  Tenants: Acme Corp (demo), Globex (demo)");
  console.log("  Usuarios demo (password " + DEMO_PASSWORD + "): alice/bob/carol/dave/frank @demo.teseo");
  console.log("  Invitación pendiente: eve@demo.teseo en Acme");
  process.exit(0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
