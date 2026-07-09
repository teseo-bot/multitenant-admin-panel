// app/api/public/partners/verify/route.ts
// PA4-W4a — endpoint público de verificación de manifiestos de aliado (TRD-Aliados-
// Conocimiento-Certificado.md §7.5). SIN auth (RP: cualquiera debe poder reproducir la
// verificación), solo lectura, cache 1h.
//
// GET ?package_id=<uuid>&version=<int>
//
// DESVIACIÓN reportada: TRD §7.5 documenta los query params como
// `?partner={slug}&package={slug}&version={n}` y una respuesta con `public_key_pem` +
// `checked_at` + `concepts_checked`. La WU de esta pieza da libertad explícita para elegir
// el par de query params ("o el par de query params que elijas; documenta cuál") y fija su
// propia forma de respuesta (`{verified, package_id, version, manifest_sha256,
// kms_key_version}`, sin `public_key_pem`/`checked_at`/`concepts_checked`). Se sigue la WU
// (instrucción operativa de esta pieza) y se elige `package_id` (UUID) + `version` (int)
// porque son exactamente las columnas de la UNIQUE constraint real de
// `partner_package_versions` (migrations-gcp/006_partners.sql) — no hace falta resolver un
// slug de paquete a id antes de poder consultar. Si se requiere adherencia estricta al TRD
// (slugs en la URL, forma de respuesta extendida), es un cambio de contrato en una WU aparte.
//
// 1. Lee partner_package_versions por (package_id, version) → 404 si no existe.
// 2. Resuelve partners.kms_key_id vía el JOIN a partner_packages → partners.
// 3. Obtiene la llave pública vía PublicKeyFetcher inyectable (lib/partners/kms-public-key.ts)
//    — la impl real usa Cloud KMS (dependencia no instalada aún, ver ese archivo).
// 4. Verifica con el módulo PURO lib/partners/manifest-verify.ts (espejo de
//    context-kdb-compiler/src/partners/signer.ts).

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyManifest } from "@/lib/partners/manifest-verify";
import { defaultPublicKeyFetcher } from "@/lib/partners/kms-public-key";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "public, max-age=3600" } as const;

// Nota: `publicKeyFetcher` NO se inyecta vía el handler `GET` — Next.js App Router invoca
// siempre `GET(req, { params })`, así que un segundo parámetro custom nunca recibiría un
// fake en runtime real. La inyectabilidad pedida por la WU vive en el módulo puro
// (lib/partners/manifest-verify.ts::verifyManifest) y en la interfaz PublicKeyFetcher
// (lib/partners/kms-public-key.ts) — los tests cubren esos dos directamente, no esta ruta.
export async function GET(req: NextRequest) {
  const publicKeyFetcher = defaultPublicKeyFetcher;

  try {
    const packageId = req.nextUrl.searchParams.get("package_id");
    const versionRaw = req.nextUrl.searchParams.get("version");
    const version = versionRaw !== null ? Number(versionRaw) : NaN;

    if (!packageId || !versionRaw || !Number.isInteger(version)) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: [{ path: "package_id|version", message: "package_id (uuid) y version (int) son requeridos" }],
        },
        { status: 422 }
      );
    }

    const { rows } = await pool.query(
      `SELECT
         v.package_id, v.version, v.manifest, v.manifest_sha256, v.signature_b64, v.kms_key_version,
         p.kms_key_id
       FROM partner_package_versions v
       JOIN partner_packages pp ON pp.id = v.package_id
       JOIN partners p ON p.id = pp.partner_id
       WHERE v.package_id = $1 AND v.version = $2`,
      [packageId, version]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Versión de paquete no encontrada" }, { status: 404 });
    }

    const row = rows[0];
    const manifest = {
      ...row.manifest,
      manifest_sha256: row.manifest_sha256,
      signature_b64: row.signature_b64,
      kms_key_version: row.kms_key_version,
    };

    let verified = false;
    if (row.kms_key_id) {
      try {
        const publicKeyPem = await publicKeyFetcher.getPublicKeyPem(row.kms_key_id, row.kms_key_version);
        verified = verifyManifest(manifest, publicKeyPem) === "verified";
      } catch (err) {
        logger.error("api.public.partners.verify.public_key_error", { error: String(err), packageId, version });
        verified = false;
      }
    } else {
      logger.warn("api.public.partners.verify.no_kms_key_id", { packageId, version });
    }

    return NextResponse.json(
      {
        verified,
        package_id: row.package_id,
        version: row.version,
        manifest_sha256: row.manifest_sha256,
        kms_key_version: row.kms_key_version,
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.public.partners.verify.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
