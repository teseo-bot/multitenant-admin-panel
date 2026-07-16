// app/api/partners/me/drafts/update/route.ts
// KL3-W1: guarda la curaduría de un draft de `_staging/` (editor guiado P-KL3). Sin autosave
// (v1 explícito, DISEÑO-Knowledge-Lab.md §4): el aliado dispara el guardado.
//
// PATCH {draft_path, markdown}
//  1. requirePartnerMember() (RP-KL7).
//  2. Proxy a `POST /internal/partner-draft-update` (PA2-W3, ya existente en el compiler) con
//     `{partner_id, draft_path, markdown}` — `partner_id` SIEMPRE de la sesión. El compiler
//     valida path bajo `_staging/`, curator completo y frontmatter contra
//     `PartnerConceptFrontmatterSchema` (422 si falla cualquiera); fuerza `confidence:'draft'`.
//
// [INV-KL3]/INV-2.2: esta es la ÚNICA ruta de escritura de drafts que expone el panel — el
// asistente IA (KL3-W2/KL4-W2, aún no construidos) y los quick-fixes del validador (KL4-W1)
// deben pasar por aquí también, nunca escribir directo al bundle.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePartnerMember } from "@/lib/partners/session";
import { logger } from "@/lib/logger";
import { updatePartnerDraftViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

const UpdateDraftBodySchema = z.object({
  draft_path: z.string().min(1),
  markdown: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateDraftBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 422 }
      );
    }

    try {
      const result = await updatePartnerDraftViaCompiler({
        partner_id: guard.partner.id,
        draft_path: parsed.data.draft_path,
        markdown: parsed.data.markdown,
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CompilerCallError) {
        const status = err.status === 422 ? 422 : 502;
        return NextResponse.json({ error: err.message }, { status });
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.drafts.update.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
