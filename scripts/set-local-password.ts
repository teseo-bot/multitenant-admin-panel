// scripts/set-local-password.ts  (LOCAL-ONLY, dev utility)
// Fija el password de un usuario en Firebase Identity Platform LOCAL.
// Migrado a GCP: requiere ADC + GOOGLE_CLOUD_PROJECT=micontexto-control al ejecutar.
//   node_modules/.bin/tsx scripts/set-local-password.ts <email> <password>
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) { console.error("Uso: set-local-password <email> <password>"); process.exit(1); }

  const { adminAuth } = await import("@/lib/gcp-auth/admin");
  const auth = adminAuth();
  const user = await auth.getUserByEmail(email);
  if (!user) { console.error(`ABORT: no existe usuario ${email}`); process.exit(1); }

  await auth.updateUser(user.uid, { password });
  console.log(`OK: password actualizado para ${email} (local).`);
  process.exit(0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
