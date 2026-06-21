// scripts/set-local-password.ts  (LOCAL-ONLY, dev utility)
// Fija el password de un usuario en el Supabase LOCAL.
//   node_modules/.bin/tsx scripts/set-local-password.ts <email> <password>
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) { console.error("Uso: set-local-password <email> <password>"); process.exit(1); }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!/127\.0\.0\.1|localhost/.test(supaUrl)) {
    console.error(`ABORT: NEXT_PUBLIC_SUPABASE_URL no es local (${supaUrl}). Local-only.`);
    process.exit(1);
  }

  const { getSupabaseAdmin, findUserByEmail } = await import("@/lib/supabase/admin");
  const admin = getSupabaseAdmin();
  const user = await findUserByEmail(email);
  if (!user) { console.error(`ABORT: no existe usuario ${email}`); process.exit(1); }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) { console.error("ERROR:", error.message); process.exit(1); }
  console.log(`OK: password actualizado para ${email} (local).`);
  process.exit(0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
