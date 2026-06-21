// WU-08: marca a un usuario como Platform Admin (app_metadata.platform_admin=true)
// vía Supabase Admin API. Idempotente. Reemplaza el criterio por email.
//   node_modules/.bin/tsx scripts/mark-platform-admin.ts [email]
// Sin arg usa PLATFORM_ADMIN_EMAIL.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

(async () => {
  const email = process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL;
  if (!email) { console.error("ABORT: falta email (arg o PLATFORM_ADMIN_EMAIL)"); process.exit(1); }

  // GUARDA LOCAL-ONLY: este script sólo opera contra Supabase local. Para prod
  // se ejecuta deliberadamente con otra autorización (no desde aquí).
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!/127\.0\.0\.1|localhost/.test(supaUrl)) {
    console.error(`ABORT: NEXT_PUBLIC_SUPABASE_URL no es local (${supaUrl}). Este script es local-only.`);
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Buscar el usuario por email (paginando si hace falta).
  let target: any = null;
  for (let page = 1; page <= 20 && !target; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error("ERROR listUsers:", error.message); process.exit(1); }
    target = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (data.users.length < 200) break;
  }
  if (!target) { console.error(`ABORT: no existe usuario con email ${email}`); process.exit(1); }

  const { error: upErr } = await admin.auth.admin.updateUserById(target.id, {
    app_metadata: { ...target.app_metadata, platform_admin: true },
  });
  if (upErr) { console.error("ERROR updateUserById:", upErr.message); process.exit(1); }

  // Verificación
  const { data: check } = await admin.auth.admin.getUserById(target.id);
  console.log(`OK: ${email} platform_admin =`, check?.user?.app_metadata?.platform_admin);
  process.exit(0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
