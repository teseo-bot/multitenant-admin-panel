// scripts/create-platform-admin.ts
// G1-W3(M): crea el usuario admin en Identity Platform y lo marca platform_admin.
// Complementa a mark-platform-admin.ts (que ABORTA si el usuario no existe).
// Idempotente: si el usuario ya existe, solo asegura el claim.
//
// La contraseña inicial es aleatoria y NO se imprime ni se persiste: el admin la
// define él mismo vía "¿Olvidaste tu contraseña?" en el login (correo de reset por
// el SMTP custom de Resend, remitente noreply@micontexto.com — ver G1-W3 del plan
// de migración v2). Así la credencial nunca pasa por chat/logs.
//
// Uso (MANUAL(CEO) o operador con ADC del proyecto de control):
//   gcloud auth application-default login          # cuenta con permisos en micontexto-control
//   npx tsx scripts/create-platform-admin.ts <email>
import { randomBytes } from "node:crypto";
import { adminAuth } from "../lib/gcp-auth/admin";

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error("ABORT: uso: npx tsx scripts/create-platform-admin.ts <email>");
    process.exit(1);
  }

  const auth = adminAuth();

  let user = await auth.getUserByEmail(email).catch(() => null);
  if (user) {
    console.log(`· ${email} ya existe (uid ${user.uid}) — solo se asegura el claim.`);
  } else {
    user = await auth.createUser({
      email,
      emailVerified: true,
      // Aleatoria y desechada: el acceso real se establece con el reset por correo.
      password: randomBytes(32).toString("base64url"),
    });
    console.log(`✓ Usuario creado: ${email} (uid ${user.uid}).`);
  }

  if (user.customClaims?.platform_admin === true) {
    console.log(`✓ ${email} ya es platform_admin. Nada que hacer.`);
    return;
  }

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    platform_admin: true,
  });

  const verified = await auth.getUser(user.uid);
  console.log(
    `✓ platform_admin=${verified.customClaims?.platform_admin} para ${email} (uid ${verified.uid}).\n` +
    `Siguiente paso: en el login del panel usar "¿Olvidaste tu contraseña?" para definir la contraseña.`
  );
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
