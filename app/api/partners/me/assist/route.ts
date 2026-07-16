// app/api/partners/me/assist/route.ts
// KL3-W2 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §3.3): proxy del asistente IA
// del editor guiado hacia `/internal/partner-assist` (context-kdb-compiler).
//
// POST {mode, markdown?, source_ids?: string[], findings?, concept_type?, system?}:
//  1. requirePartnerMember() (RP-KL7) — member o curator, redactar no es acción de publicar.
//  2. Si vienen `source_ids`: resuelve pertenencia contra `partner_sources` del partner de
//     sesión (lib/partners/assist.ts::resolveSourceGcsObjects) — cualquier id ausente o de
//     otro aliado → 403; `kind='url'` → 422 (URLs no soportadas para el asistente en v1).
//  3. Proxy a `/internal/partner-assist` con `partner_id` DE SESIÓN (nunca el que traiga el
//     cliente) y `source_gcs_objects` ya resueltos.
//  4. Devuelve la respuesta del compiler tal cual ({markdown, report, stripped_refs}) —
//     [INV-KL3]: esta ruta no persiste nada, no arma UI (el modal es KL4-W2).

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AssistBodySchema, resolveSourceGcsObjects } from "@/lib/partners/assist";
import { runPartnerAssistViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const body = await req.json().catch(() => null);
    const parsed = AssistBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 422 }
      );
    }

    const partnerId = guard.partner.id;
    const { mode, markdown, source_ids, findings, concept_type, system } = parsed.data;

    let source_gcs_objects: string[] | undefined;
    if (source_ids && source_ids.length > 0) {
      const resolved = await resolveSourceGcsObjects(source_ids, partnerId, (text, params) =>
        pool.query(text, params)
      );
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }
      source_gcs_objects = resolved.gcs_objects;
    }

    try {
      const result = await runPartnerAssistViaCompiler({
        mode,
        partner_id: partnerId,
        markdown,
        source_gcs_objects,
        findings,
        concept_type,
        system,
      });

      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      if (err instanceof CompilerCallError) {
        const status = err.status === 422 ? 422 : 502;
        logger.error("api.partners.me.assist.compiler_error", { status: err.status, error: err.message });
        return NextResponse.json({ error: err.message }, { status });
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.assist.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
