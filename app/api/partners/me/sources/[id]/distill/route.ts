// app/api/partners/me/sources/[id]/distill/route.ts
// KL2-W2 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §3.3): destila una fuente
// registrada hacia borradores de un paquete, vía context-kdb-compiler /internal/partner-ingest.
//
// Body: {package_id}
//  1. Verifica que la fuente sea del partner de sesión (RP-KL7) — 404 si no existe/no es suya.
//  2. kind !== 'doc' → 422 "destilado de URL no soportado v1" (el compiler ingesta documentos;
//     no hay fetch de URLs en v1 — ver PLAN-KnowledgeLab-Epicas-KL.md KL2-W2).
//  3. Verifica que el package sea del partner (404 si no).
//  4. UPDATE ingest_status='distilling' → llama /internal/partner-ingest con
//     {partner_id, package_slug, source_gcs_object} (KL2-W2 extendió el compiler para leer el
//     binario server-side desde _fuentes/ en vez de que el panel lo reenvíe — ver
//     context-kdb-compiler/src/partners/partner-ingest.ts::resolveDocument).
//  5. Éxito → ingest_status='distilled' + {drafts}. Fallo → ingest_status='failed' + 502.

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { DistillSourceBodySchema, type PartnerSourceRow } from "@/lib/partners/sources";
import { ingestPartnerSourceViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const { id: sourceId } = await context.params;
    const partnerId = guard.partner.id;

    const body = await req.json().catch(() => null);
    const parsed = DistillSourceBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 422 }
      );
    }
    const { package_id } = parsed.data;

    // 1. La fuente debe pertenecer al partner de sesión (RP-KL7)
    const { rows: sourceRows } = await pool.query<PartnerSourceRow>(
      `SELECT id, partner_id, kind, title, source_ref, gcs_object, ingest_status, created_by, created_at
         FROM partner_sources
        WHERE id = $1 AND partner_id = $2`,
      [sourceId, partnerId]
    );
    const source = sourceRows[0];
    if (!source) {
      return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });
    }

    // 2. v1 solo destila documentos; URLs no soportadas (el compiler ingesta documentos, no
    // hace fetch de URLs — no se inventa esa capacidad aquí).
    if (source.kind !== "doc") {
      return NextResponse.json(
        { error: "Destilado de URL no soportado v1" },
        { status: 422 }
      );
    }
    if (!source.gcs_object) {
      // No debería ocurrir (todo source kind='doc' se crea con gcs_object), pero se protege
      // contra datos inconsistentes en vez de mandar un source_gcs_object nulo al compiler.
      return NextResponse.json(
        { error: "La fuente no tiene objeto asociado en el bundle" },
        { status: 422 }
      );
    }

    // 3. El package debe pertenecer al partner de sesión
    const { rows: packageRows } = await pool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM partner_packages WHERE id = $1 AND partner_id = $2`,
      [package_id, partnerId]
    );
    const pkg = packageRows[0];
    if (!pkg) {
      return NextResponse.json({ error: "Paquete no encontrado" }, { status: 404 });
    }

    // 4. Marca distilling y llama al compiler
    await pool.query(`UPDATE partner_sources SET ingest_status = 'distilling' WHERE id = $1`, [source.id]);

    try {
      const result = await ingestPartnerSourceViaCompiler({
        partner_id: partnerId,
        package_slug: pkg.slug,
        source_gcs_object: source.gcs_object,
      });

      await pool.query(`UPDATE partner_sources SET ingest_status = 'distilled' WHERE id = $1`, [source.id]);

      // La columna `detail` JSONB no existe en partner_sources (migrations-gcp/009) — el
      // conteo de drafts se devuelve en la respuesta, no se persiste (regla: no inventar
      // columnas, PLAN-KnowledgeLab-Epicas-KL.md KL2-W2).
      return NextResponse.json({ drafts: result.drafts, count: result.drafts.length }, { status: 200 });
    } catch (err) {
      await pool.query(`UPDATE partner_sources SET ingest_status = 'failed' WHERE id = $1`, [source.id]);

      if (err instanceof CompilerCallError) {
        logger.error("api.partners.me.sources.distill.compiler_error", {
          sourceId: source.id,
          status: err.status,
          error: err.message,
        });
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.sources.distill.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
