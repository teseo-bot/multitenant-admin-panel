// app/api/admin/partners/[id]/members/route.ts
// Knowledge Ops: membresías de un aliado (`partner_members`).
//
// Es la pieza que faltaba para que un aliado pueda USAR el portal: la fila en
// `partner_members` es lo único que `requirePartnerMember` acepta (el claim
// acelera, la BD manda — RP-KL7). Sin esto, una cuenta autentica bien y cae en
// /unauthorized, y no había forma de crearla salvo SQL directo.
//
// El rol distingue quién FIRMA: 'curator' publica y firma paquetes; 'member'
// solo edita. Por eso el alta es explícita en el rol, sin default silencioso.
//
// Guard: requirePlatformAdmin, igual que el resto de /api/admin/partners.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  aliadosIdpConfigured,
  resolveAliadoUserByEmail,
  buildPasswordSetupLink,
} from "@/lib/partners/aliados-idp";

export const dynamic = "force-dynamic";

const MEMBER_COLUMNS = "partner_id, user_id, member_role, created_at, onboarded_at";

// Dos formas de alta: por correo (resuelve/crea en el IdP de aliados) o por uid
// explícito, que es el escape cuando el puente al IdP no está cableado.
const AddMemberBodySchema = z
  .object({
    email: z.string().email().optional(),
    user_id: z.string().min(1).optional(),
    member_role: z.enum(["member", "curator"]),
    create_if_missing: z.boolean().optional().default(false),
  })
  .refine((b) => Boolean(b.email) || Boolean(b.user_id), {
    message: "Indica el correo del aliado o su user_id",
  });

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const { rows } = await pool.query(
      `SELECT ${MEMBER_COLUMNS} FROM partner_members WHERE partner_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({ members: rows, idp_configured: aliadosIdpConfigured() });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.members.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const parsed = AddMemberBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Cuerpo inválido", details: zodDetails(parsed.error.issues) },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const partner = await pool.query("SELECT id, status FROM partners WHERE id = $1", [id]);
    if (partner.rowCount === 0) {
      return NextResponse.json({ error: "Aliado no encontrado" }, { status: 404 });
    }

    let userId = body.user_id ?? null;
    let created = false;
    let setupLink: string | null = null;

    if (!userId) {
      if (!aliadosIdpConfigured()) {
        return NextResponse.json(
          {
            error:
              "El puente al Identity Platform de aliados no está configurado (ALIADOS_IDP_PROJECT_ID / ALIADOS_IDP_TENANT_ID). Da de alta la cuenta en ese proyecto y captura su user_id.",
          },
          { status: 503 }
        );
      }

      try {
        const resolved = await resolveAliadoUserByEmail(body.email!, body.create_if_missing);
        userId = resolved.uid;
        created = resolved.created;
      } catch (err: any) {
        const status = err?.status === 404 ? 404 : 502;
        logger.error("api.admin.partners.members.idp.error", {
          error: String(err),
          code: err?.code,
        });
        return NextResponse.json(
          { error: err?.message ?? "No se pudo resolver la cuenta en el pool de aliados" },
          { status }
        );
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO partner_members (partner_id, user_id, member_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (partner_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role
       RETURNING ${MEMBER_COLUMNS}`,
      [id, userId, body.member_role]
    );

    // El enlace se genera solo para cuentas recién creadas: es lo que el admin
    // le pasa al aliado para que fije su contraseña. No se envía correo desde
    // aquí (el remitente vive en el proyecto del portal).
    if (created && body.email) {
      try {
        setupLink = await buildPasswordSetupLink(body.email);
      } catch (err) {
        logger.error("api.admin.partners.members.link.error", { error: String(err) });
      }
    }

    logger.info("api.admin.partners.members.added", {
      partner_id: id,
      user_id: userId,
      member_role: body.member_role,
      created_account: created,
    });

    return NextResponse.json({ member: rows[0], created_account: created, setup_link: setupLink }, {
      status: 201,
    });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.members.post.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
