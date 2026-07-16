// scripts/invite-partner-member.ts
// KL1-W1: alta manual de un miembro de aliado (mientras PA4-W1 — onboarding real —
// no exista; ver PLAN-KnowledgeLab-Epicas-KL.md, gate KL1).
//
// Espeja el patrón de identidad de lib/services/invitations.ts (Auth primero, crea o
// reutiliza; DB después) y el de custom claims de scripts/mark-platform-admin.ts
// (setCustomUserClaims preservando claims existentes). El canal de correo es el ya
// existente del panel: lib/mailer.ts (Gmail API + Domain-Wide Delegation, con
// dry-run/log si faltan credenciales — el propio mailer degrada solo).
//
// Uso:
//   npx tsx scripts/invite-partner-member.ts \
//     --partner-slug bufete-demo --email ana@bufete-demo.mx --role curator [--name "Ana Pérez"]
//
// Idempotente: si el usuario de Identity Platform ya existe, se reutiliza (se le
// añade/actualiza el claim partner_id/partner_role preservando otros claims); si la
// fila de partner_members ya existe, se actualiza el rol (ON CONFLICT DO UPDATE).

import { parseArgs } from "node:util";
import { adminAuth } from "../lib/gcp-auth/admin";
import { pool } from "../lib/db";
import { sendMail } from "../lib/mailer";

type PartnerRole = "member" | "curator";

function usageAndExit(msg?: string): never {
  if (msg) console.error(`ABORT: ${msg}`);
  console.error(
    "Uso: npx tsx scripts/invite-partner-member.ts --partner-slug <slug> --email <email> --role member|curator [--name \"Nombre\"]"
  );
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "partner-slug": { type: "string" },
      email: { type: "string" },
      role: { type: "string" },
      name: { type: "string" },
    },
  });

  const partnerSlug = values["partner-slug"];
  const email = values.email;
  const role = values.role as PartnerRole | undefined;
  const fullName = values.name;

  if (!partnerSlug || !email || !role) {
    usageAndExit("faltan --partner-slug, --email o --role");
  }
  if (role !== "member" && role !== "curator") {
    usageAndExit(`--role debe ser 'member' o 'curator' (recibido: '${role}')`);
  }

  // 1) Resolver el aliado por slug (falla explícito si no existe: no se inventa).
  const { rows: partnerRows } = await pool.query(
    `SELECT id, slug, legal_name, status FROM partners WHERE slug = $1`,
    [partnerSlug]
  );
  const partner = partnerRows[0];
  if (!partner) {
    console.error(`ABORT: no existe un aliado con slug '${partnerSlug}' en partners.`);
    process.exit(1);
  }

  // 2) Identidad en Identity Platform: crea o reutiliza (espejo de invitations.ts).
  const auth = adminAuth();
  let uid: string;
  let reusedIdentity = false;
  try {
    const user = await auth.createUser({
      email,
      ...(fullName && { displayName: fullName }),
    });
    uid = user.uid;
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      reusedIdentity = true;
    } else {
      console.error("ABORT: fallo al crear/resolver el usuario en Identity Platform:", err);
      process.exit(1);
    }
  }

  // 3) Custom claims: preserva claims existentes (p.ej. platform_admin) y fija
  //    partner_id/partner_role — espejo exacto de mark-platform-admin.ts.
  const existing = await auth.getUser(uid!);
  await auth.setCustomUserClaims(uid!, {
    ...(existing.customClaims ?? {}),
    partner_id: partner.id,
    partner_role: role,
  });
  console.log(
    `✓ Claims actualizados para ${email} (uid ${uid}): partner_id=${partner.id}, partner_role=${role}` +
      (reusedIdentity ? " (identidad reutilizada)" : " (identidad nueva)")
  );

  // 4) partner_members: idempotente, ON CONFLICT actualiza el rol.
  await pool.query(
    `INSERT INTO partner_members (partner_id, user_id, member_role)
     VALUES ($1, $2, $3)
     ON CONFLICT (partner_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role`,
    [partner.id, uid, role]
  );
  console.log(`✓ partner_members: ${email} => ${partner.legal_name} (${partnerSlug}) como '${role}'`);

  // 5) Enlace de set-password (mismo mecanismo que invitations.ts) + envío por el
  //    canal de correo existente del panel (lib/mailer.ts). El enlace SIEMPRE se
  //    imprime en consola: si el mailer está en modo dry-run (sin credenciales de
  //    Domain-Wide Delegation configuradas en este entorno), el admin lo copia a mano.
  const continueUrl = `${process.env.APP_URL || "http://localhost:3000"}/auth/login`;
  const passwordResetLink = await auth.generatePasswordResetLink(email, { url: continueUrl });
  console.log(`↳ Enlace para crear contraseña: ${passwordResetLink}`);

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>¡Hola!</p>
  <p>Has sido invitado a colaborar con <strong>${partner.legal_name}</strong> en el Knowledge Lab de aliados, con el rol <strong>${role}</strong>.</p>
  <p>
    <a href="${passwordResetLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
      Crear contraseña
    </a>
  </p>
  <p style="font-size: 0.9em; color: #666;">
    Este enlace vence en 7 días. Si no esperabas este correo, ignóralo.
  </p>
</body>
</html>
`;

  try {
    await sendMail({
      to: email,
      subject: `Invitación al Knowledge Lab — ${partner.legal_name}`,
      html: htmlBody,
    });
    console.log(`✓ Correo de invitación enviado (o registrado en dry-run) a ${email}.`);
  } catch (err) {
    console.error(
      "AVISO: el envío de correo falló (revisa credenciales de lib/mailer.ts). " +
        "El alta y el enlace de arriba siguen siendo válidos.",
      err
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ERROR:", err);
    process.exit(1);
  });
