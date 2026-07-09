// app/api/partners/me/packages/[id]/publish/route.ts
// KL5-W1 (PLAN-KnowledgeLab-Epicas-KL.md; TRD §7.1): flujo de publicación de paquete.
//
// Orquesta: validación de permisos (curator) → verificación de pertenencia del paquete
// → lectura del status → llamada al compiler `/internal/partner-publish` → escritura
// en `partner_package_versions` + update del status del paquete → respuesta con version
// y manifest_sha256.
//
// Errores:
// - 401/403: guard / permisos
// - 404: paquete no encontrado
// - 422: validación de schema o errores de compilación (reenvía findings)
// - 409: cadena de bundle rota
// - 500: error parcial en publish (publicado en compiler pero fallo en la BD local)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  CompilerCallError,
  type ValidationReport,
  type PackageManifest,
} from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

const PublishBodySchema = z.object({
  draft_paths: z.array(z.string().min(1)).min(1, "draft_paths no puede estar vacío"),
});

interface PublishErrorResponse {
  error: string;
  reports?: ValidationReport[];
  status?: "error" | "partial_failure";
}

async function callCompilerPublish(input: {
  partner_id: string;
  partner_slug: string;
  package_id: string;
  package_slug: string;
  version: number;
  draft_paths: string[];
}): Promise<{ manifest: PackageManifest } | PublishErrorResponse> {
  const url = `${process.env.KDB_COMPILER_URL || "http://localhost:8080"}/internal/partner-publish`;
  const apiKey = process.env.M2M_API_KEY;

  if (!apiKey) {
    throw new Error("M2M_API_KEY no está configurado");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error("api.packages.publish.compiler_error", {
      path: url,
      status: res.status,
      data,
    });

    // Reenviar errores del compiler tal cual
    if (res.status === 422 && (data as any).reports) {
      return {
        error: (data as any).error || "Validación fallida",
        reports: (data as any).reports,
      };
    }

    throw new CompilerCallError(
      (data as any).error || `Error ${res.status} en el compiler`,
      res.status,
      data
    );
  }

  return data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const guard = await requirePartnerMember("curator");
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const packageId = params.id;
    const partnerId = guard.partner.id;

    // Validar body
    const body = await req.json().catch(() => null);
    const parsed = PublishBodySchema.safeParse(body);
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

    const { draft_paths } = parsed.data;

    // Verificar que el paquete sea del partner de sesión y está en estado draft o published
    const { rows: pkgRows } = await pool.query<{
      slug: string;
      status: string;
    }>(
      `SELECT slug, status FROM partner_packages
       WHERE id = $1 AND partner_id = $2`,
      [packageId, partnerId]
    );

    const pkg = pkgRows[0];
    if (!pkg) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    if (!["draft", "published"].includes(pkg.status)) {
      return NextResponse.json(
        {
          error: `No se puede publicar un paquete en estado '${pkg.status}'`,
        },
        { status: 422 }
      );
    }

    // Calcular siguiente versión
    const { rows: versionRows } = await pool.query<{ max_version: string | null }>(
      `SELECT MAX(version)::text as max_version FROM partner_package_versions
       WHERE package_id = $1`,
      [packageId]
    );

    const maxVersion = versionRows[0]?.max_version ? parseInt(versionRows[0].max_version, 10) : 0;
    const nextVersion = maxVersion + 1;

    // Llamar al compiler con `/internal/partner-publish`
    const compilerResult = await callCompilerPublish({
      partner_id: partnerId,
      partner_slug: guard.partner.slug,
      package_id: packageId,
      package_slug: pkg.slug,
      version: nextVersion,
      draft_paths,
    });

    // Si el compiler devolvió errores de validación (422), reenviarlos al cliente
    if ("reports" in compilerResult) {
      return NextResponse.json(compilerResult, { status: 422 });
    }

    // Si llegarmos aquí, el compiler respondió 200 con { manifest }
    const manifest = (compilerResult as { manifest: PackageManifest }).manifest;

    // Escribir la fila en partner_package_versions
    try {
      await pool.query(
        `INSERT INTO partner_package_versions
         (package_id, version, manifest, manifest_sha256, signature_b64, kms_key_version, published_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          packageId,
          nextVersion,
          JSON.stringify(manifest),
          manifest.manifest_sha256,
          manifest.signature_b64,
          manifest.kms_key_version,
          guard.uid,
        ]
      );

      // Actualizar el status del paquete a 'published' si no lo es ya
      if (pkg.status !== "published") {
        await pool.query(
          `UPDATE partner_packages SET status = 'published' WHERE id = $1`,
          [packageId]
        );
      }
    } catch (dbError) {
      logger.error("api.packages.publish.db_error", {
        package_id: packageId,
        version: nextVersion,
        error: String(dbError),
      });

      // El publish se hizo en el compiler, pero falló en la BD local
      // Esto no es un error total (el manifest está firmado en GCS), sino un
      // problema de sincronización. Reenviar 500 con warning y aviso de reintentar.
      return NextResponse.json(
        {
          error: "Publicado en compiler pero error al registrar versión en la BD",
          warning:
            "El paquete fue publicado y firmado correctamente. Reintentar esta solicitud cuando se recupere la BD.",
          version: nextVersion,
          manifest_sha256: manifest.manifest_sha256,
          status: "partial_failure",
        },
        { status: 500 }
      );
    }

    // Éxito: responder con la versión, hash y nº de conceptos
    return NextResponse.json({
      version: nextVersion,
      manifest_sha256: manifest.manifest_sha256,
      concepts: manifest.concepts.length,
    });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }

    if (err instanceof CompilerCallError) {
      // Errores de red o del compiler
      if (err.status === 409) {
        return NextResponse.json(
          { error: "Hash-chain roto — publish abortado sin escrituras" },
          { status: 409 }
        );
      }
      if (err.status === 404) {
        return NextResponse.json(
          { error: "Uno o más borradores no encontrados en el compiler" },
          { status: 404 }
        );
      }
      // Otros errores del compiler
      return NextResponse.json(
        { error: err.message },
        { status: err.status || 502 }
      );
    }

    logger.error("api.packages.publish.error", { error: String(err) });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
