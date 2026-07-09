// app/api/partners/me/packages/[id]/drafts/route.ts
// KL3-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4 P-KL3): lista los drafts
// pendientes (no publicados) del paquete `[id]` del aliado de sesión.
//
// GET:
//  1. requirePartnerMember() (RP-KL7: sin restricción de rol — leer drafts no es publicar).
//  2. Verifica que el paquete `[id]` sea del partner de sesión (404 si no existe/no es suyo) —
//     mismo patrón que app/api/partners/me/sources/[id]/distill/route.ts.
//  3. Proxy a `POST /internal/partner-drafts-list` con `{partner_id, package_slug}` — el
//     `partner_id` SIEMPRE sale de la sesión (guard.partner.id), nunca del cliente (RP-KL7).
//
// Nota de alcance (ver src/partners/partner-drafts-list.ts en context-kdb-compiler, KL3-W1):
// `_staging/` no está particionada por paquete (un draft no tiene paquete asignado hasta que
// se publica), así que `package_slug` en el compiler solo acota CONTRA QUÉ paquete publicado
// se compara para excluir drafts ya publicados — el listado en sí siempre trae TODOS los
// drafts pendientes del aliado. Es el comportamiento esperado, no un bug de esta ruta.

import { NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { listPartnerDraftsViaCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const { id: packageId } = await context.params;
    const partnerId = guard.partner.id;

    const { rows } = await pool.query<{ id: string; slug: string }>(
      `SELECT id, slug FROM partner_packages WHERE id = $1 AND partner_id = $2`,
      [packageId, partnerId]
    );
    const pkg = rows[0];
    if (!pkg) {
      return NextResponse.json({ error: "Paquete no encontrado" }, { status: 404 });
    }

    try {
      const result = await listPartnerDraftsViaCompiler({
        partner_id: partnerId,
        package_slug: pkg.slug,
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CompilerCallError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.packages.drafts.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
