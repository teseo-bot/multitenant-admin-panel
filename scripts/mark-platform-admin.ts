// scripts/mark-platform-admin.ts
// G1-W3 (§A6): marca a un usuario como platform_admin vía CUSTOM CLAIM en Identity Platform.
// Reemplaza la versión Supabase (WU-08, app_metadata). Idempotente.
//
// Uso (MANUAL(CEO), con credenciales del proyecto de control):
//   gcloud auth application-default login          # cuenta Owner de micontexto-control
//   gcloud auth application-default set-quota-project micontexto-control
//   npx tsx scripts/mark-platform-admin.ts <email>
//
// adminAuth() usa applicationDefault() (ADC) → opera sobre el IdP del proyecto de
// las credenciales activas. Nota de seguridad: ya NO hay guard "Supabase local"
// (obsoleto); la salvaguarda es que el marcado de prod es un acto DELIBERADO del
// CEO con las credenciales del proyecto control (email explícito, sin default).
import { adminAuth } from "../lib/gcp-auth/admin";

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error("ABORT: uso: npx tsx scripts/mark-platform-admin.ts <email>");
    process.exit(1);
  }

  const auth = adminAuth();
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(
      `ABORT: no existe usuario con email ${email} en el IdP. ` +
      `Créalo primero (Console → Identity Platform → Users → Add user).`
    );
    process.exit(1);
  }

  // Idempotente: si ya es platform_admin, no-op.
  if (user.customClaims?.platform_admin === true) {
    console.log(`✓ ${email} (uid ${user.uid}) ya es platform_admin. Nada que hacer.`);
    return;
  }

  // Preservar cualquier claim existente (p.ej. partner_id) al añadir platform_admin.
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    platform_admin: true,
  });
  console.log(
    `✓ ${email} (uid ${user.uid}) marcado platform_admin. ` +
    `Debe cerrar sesión y volver a entrar para refrescar el claim.`
  );
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
