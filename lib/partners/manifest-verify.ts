// lib/partners/manifest-verify.ts
// PA4-W4a — módulo PURO de verificación de manifiestos de aliado (TRD-Aliados-Conocimiento-
// Certificado.md §6.3, §7.5). ESPEJO TEXTUAL de `canonicalize` y `verifyManifest` desde
// context-kdb-compiler/src/partners/signer.ts (PA2-W2) — mismo patrón de mirror con
// comentario de origen que lib/partners/contracts.ts, lib/partners/templates.ts,
// lib/api/users.ts. NO editar signer.ts a partir de aquí; si signer.ts cambia, re-copiar.
//
// Sin BD, sin red, sin KMS: recibe el manifest ya leído y el PEM de la llave pública ya
// resuelto (ver app/api/public/partners/verify/route.ts para el I/O real).

import { createHash, createVerify } from "node:crypto";

/**
 * Canonicaliza un objeto JSON para firma:
 * - Ordena claves recursivamente
 * - Excluye campos de firma (manifest_sha256, signature_b64, kms_key_version)
 * - Compacto (sin espacios)
 * - LF para separadores de línea
 * - UTF-8
 */
export function canonicalize(obj: Record<string, any>): string {
  function sortKeys(o: any): any {
    if (Array.isArray(o)) {
      return o.map(sortKeys);
    } else if (o !== null && typeof o === "object") {
      // Excluir campos de firma
      const filtered = Object.keys(o)
        .filter((k) => !["manifest_sha256", "signature_b64", "kms_key_version"].includes(k))
        .sort()
        .reduce((result, key) => {
          result[key] = sortKeys(o[key]);
          return result;
        }, {} as Record<string, any>);
      return filtered;
    }
    return o;
  }

  const sorted = sortKeys(obj);
  const canonical = JSON.stringify(sorted, null, 0); // Compacto, sin espacios
  // Asegurar LF y UTF-8
  return canonical + "\n";
}

/**
 * Verifica un manifiesto firmado
 * Recanonicaliza el manifiesto (excluyendo campos de firma),
 * recomputa el SHA256, y verifica la firma con la llave pública.
 * Devuelve 'verified' o 'unverified' (jamás lanza excepciones)
 */
export function verifyManifest(
  manifest: Record<string, any>,
  publicKeyPem: string
): "verified" | "unverified" {
  try {
    // Recanonicalizar (excluyendo campos de firma)
    const recanonical = canonicalize(manifest);

    // Recomputar SHA256
    const computedSha256 = createHash("sha256").update(recanonical, "utf-8").digest("hex");

    // Verificar que el SHA256 en el manifiesto coincida
    if (manifest.manifest_sha256 !== computedSha256) {
      console.warn("[verify] SHA256 mismatch");
      return "unverified";
    }

    // Extraer la firma
    const signatureB64 = manifest.signature_b64;
    if (!signatureB64 || typeof signatureB64 !== "string") {
      console.warn("[verify] Missing or invalid signature_b64");
      return "unverified";
    }

    // Decodificar firma de base64
    const signature = Buffer.from(signatureB64, "base64");

    // Verificar la firma con la llave pública (ECDSA P-256 + SHA256)
    const verifier = createVerify("sha256");
    verifier.update(recanonical, "utf-8");

    if (verifier.verify(publicKeyPem, signature)) {
      return "verified";
    } else {
      console.warn("[verify] Signature verification failed");
      return "unverified";
    }
  } catch (error) {
    console.warn("[verify] Exception during verification:", error);
    return "unverified";
  }
}
