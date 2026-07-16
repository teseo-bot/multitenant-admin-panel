// app/api/partners/me/drafts/get/route.ts
// KL3-W1: lee el markdown crudo de un draft de `_staging/` para el editor guiado (P-KL3).
//
// GET ?path=_staging/{fecha}/{slug}.md
//  1. requirePartnerMember() (RP-KL7).
//  2. Proxy a `POST /internal/partner-draft-get` con `{partner_id, draft_path}` — `partner_id`
//     SIEMPRE de la sesión (RP-KL7). El guard anti-traversal (draft_path bajo `_staging/`) lo
//     aplica el compiler (reúsa `validateDraftPath` de `partner-draft-update.ts`); aquí solo se
//     traduce su 422 tal cual.
//
// Forma REST: GET con query param `path` (no un segmento dinámico `[...path]` en la ruta de
// API) porque `draft_path` puede incluir subcarpetas de fecha (`_staging/2026-07-08/slug.md`)
// y caracteres que conviene mandar como un solo query param codificado, sin depender de cómo
// Next.js decodifica segmentos catch-all en rutas de API.

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { logger } from "@/lib/logger";
import { getPartnerDraftViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const draftPath = req.nextUrl.searchParams.get("path");
    if (!draftPath) {
      return NextResponse.json(
        { error: "Validación fallida", details: [{ path: "path", message: "path es requerido" }] },
        { status: 422 }
      );
    }

    try {
      const result = await getPartnerDraftViaCompiler({
        partner_id: guard.partner.id,
        draft_path: draftPath,
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CompilerCallError) {
        const status = err.status === 422 ? 422 : err.status === 404 ? 404 : 502;
        return NextResponse.json({ error: err.message }, { status });
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.drafts.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
