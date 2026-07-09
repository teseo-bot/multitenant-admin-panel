// app/api/partners/me/drafts/validate/route.ts
// KL4-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4 P-KL3): panel validador
// en vivo del editor. Proxy a `/internal/partner-validate` del compiler.
//
// POST {draft_path, markdown, package_id}:
//  1. requirePartnerMember() (RP-KL7).
//  2. Verifica que el paquete `package_id` sea del partner de sesión (404 si no existe/no es suyo).
//  3. Llama al listado de drafts del paquete para construir `package_paths` (los paths de los
//     drafts hermanos, normalizados con `/` inicial — ruta KL3-W1 que ya existe).
//  4. Proxy a `/internal/partner-validate` con `partner_id` DE SESIÓN, `for_publish:false`.
//  5. Devuelve el ValidationReport (findings + valid).
//
// [INV-KL3]: el validador NO guarda nada — es solo lectura + análisis. El usuario ve los
// findings y elige aplicar quick-fixes manualmente (button en el UI) o guardar (ruta update).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  validatePartnerDraftViaCompiler,
  CompilerCallError,
  type ValidationReport,
} from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

const ValidateDraftBodySchema = z.object({
  draft_path: z.string().min(1),
  markdown: z.string().min(1),
  package_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const body = await req.json().catch(() => null);
    const parsed = ValidateDraftBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }

    const partnerId = guard.partner.id;
    const { draft_path, markdown, package_id } = parsed.data;

    // Verificar que el paquete `package_id` sea del partner de sesión
    const { rows } = await pool.query<{ slug: string }>(
      `SELECT slug FROM partner_packages WHERE id = $1 AND partner_id = $2`,
      [package_id, partnerId]
    );
    const pkg = rows[0];
    if (!pkg) {
      return NextResponse.json({ error: "Paquete no encontrado" }, { status: 404 });
    }

    try {
      // Obtener la lista de drafts del paquete para construir package_paths
      const listRes = await fetch(`${process.env.KDB_COMPILER_URL || "http://localhost:8080"}/internal/partner-drafts-list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.M2M_API_KEY || "",
        },
        body: JSON.stringify({
          partner_id: partnerId,
          package_slug: pkg.slug,
        }),
      });

      if (!listRes.ok) {
        throw new CompilerCallError(
          "Error al listar drafts del paquete",
          listRes.status,
          await listRes.json().catch(() => ({}))
        );
      }

      const listData = await listRes.json();
      const packagePaths = (listData.drafts || []).map((draft: { path: string }) => {
        // Normalizar path: asegurar que comience con /
        const normalized = draft.path.startsWith("/") ? draft.path : `/${draft.path}`;
        return normalized;
      });

      // Llamar al validador del compiler con for_publish:false
      const report = await validatePartnerDraftViaCompiler({
        partner_id: partnerId,
        markdown,
        package_paths: packagePaths,
        for_publish: false,
      });

      return NextResponse.json(report);
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
    logger.error("api.partners.me.drafts.validate.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
