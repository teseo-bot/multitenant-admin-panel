// app/api/admin/partners/route.ts
// PA4-W1 — Knowledge Ops: CRUD de aliados (TRD §7.2).
//
// Guard: `requirePlatformAdmin` (lib/auth/guards.ts). DESVIACIÓN reportada: la WU pide
// espejar un guard literal `super_admin` (`grep -rn "super_admin" app/api lib`); ese string
// no existe en el código real. El guard de plataforma real es `requirePlatformAdmin`
// (claim `platform_admin === true`), usado por TODAS las rutas admin existentes
// (app/api/admin/users/route.ts, app/api/admin/memberships/route.ts, etc.) — se usa aquí
// por ser el equivalente real y único.
//
// GET: lista aliados.
// POST: alta de aliado (status inicial 'pending_verification', DDL default) y dispara
// `/internal/partner-bundle-create` vía compiler-client (TRD §7.2). El provisioning de la
// llave KMS (`provisionPartnerKey`) NO se llama aquí — ver TODO PA2-W2-followup abajo.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createPartnerBundleViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

const PARTNER_COLUMNS =
  "id, slug, legal_name, vertical, contact_email, status, kms_key_id, created_at";

// Mirror de campos de alta de PartnerSchema (contracts/src/partners.ts) — slug/legal_name/
// vertical/contact_email son los únicos que el admin provee; status/kms_key_id/id/created_at
// los fija el servidor.
const CreatePartnerBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,39}$/, {
    message: "slug debe empezar con letra/número, minúsculas y guiones, 3-40 chars",
  }),
  legal_name: z.string().min(3).max(160),
  vertical: z.enum(["legal", "marketing", "consultoria", "reclutamiento", "otro"]),
  contact_email: z.string().email(),
});

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { rows } = await pool.query(
      `SELECT ${PARTNER_COLUMNS} FROM partners ORDER BY created_at DESC`
    );
    return NextResponse.json({ partners: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const parsed = CreatePartnerBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const { slug, legal_name, vertical, contact_email } = parsed.data;

    let partnerRow;
    try {
      const { rows } = await pool.query(
        `INSERT INTO partners (slug, legal_name, vertical, contact_email)
         VALUES ($1, $2, $3, $4)
         RETURNING ${PARTNER_COLUMNS}`,
        [slug, legal_name, vertical, contact_email]
      );
      partnerRow = rows[0];
    } catch (err: any) {
      if (err.code === "23505") {
        return NextResponse.json({ error: "Ya existe un aliado con ese slug" }, { status: 409 });
      }
      throw err;
    }

    // TRD §7.2: el alta dispara la creación del bundle. Si falla, el aliado ya quedó
    // creado en BD (no se revierte: el bundle puede reintentarse — no hay endpoint de
    // reintento en esta WU, se deja constancia en el log de error).
    try {
      await createPartnerBundleViaCompiler({ partner_id: partnerRow.id });
    } catch (err) {
      logger.error("api.admin.partners.post.bundle_create_failed", {
        partner_id: partnerRow.id,
        error: err instanceof CompilerCallError ? err.message : String(err),
      });
    }

    // TODO PA2-W2-followup: provisionPartnerKey(slug) existe como función pura en
    // context-kdb-compiler/src/partners/signer.ts pero NO está expuesta por ninguna ruta
    // `/internal/*` (confirmado: `grep -rn "provisionPartnerKey" src` en context-kdb-compiler
    // solo encuentra su propia definición, cero llamadores). Esta WU (panel) no puede
    // invocar una ruta M2M que no existe — inventarla aquí sería diseñar fuera de esta WU.
    // Falta: una ruta `/internal/partner-provision-key` (o incorporar la provisión dentro
    // de `/internal/partner-bundle-create`) en context-kdb-compiler, y luego el call aquí.
    // `partners.kms_key_id` queda NULL hasta que esa WU de seguimiento se ejecute.

    return NextResponse.json(partnerRow, { status: 201 });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.post.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
