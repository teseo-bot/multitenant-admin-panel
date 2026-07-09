// lib/partners/kms-public-key.ts
// PA4-W4a — resolución de la llave pública de un aliado para verificación de manifiestos
// (TRD-Aliados-Conocimiento-Certificado.md §6, §7.5). La llave vive en Cloud KMS
// (keyring `kdb-partners`, llave `partner-{slug}` — ver context-kdb-compiler/src/partners/
// signer.ts::provisionPartnerKey); `partners.kms_key_id` + `kms_key_version` (columna de
// `partner_package_versions`) la identifican.
//
// Interfaz inyectable para poder testear `verifyManifest` (lib/partners/manifest-verify.ts)
// sin KMS real — la ruta pública (app/api/public/partners/verify/route.ts) usa
// `defaultPublicKeyFetcher` en producción y un fake en tests.
//
// DESVIACIÓN reportada: la dependencia `@google-cloud/kms` NO está instalada en
// multitenant-admin-panel (sí lo está en context-kdb-compiler). La WU pide explícitamente
// NO instalarla y dejar la impl real detrás de un import dinámico o un TODO claro. Se opta
// por lo segundo: `defaultPublicKeyFetcher.getPublicKeyPem` lanza un error explícito hasta
// que se instale la dependencia y se complete el TODO de abajo.

export interface PublicKeyFetcher {
  getPublicKeyPem(kmsKeyId: string, kmsKeyVersion: string): Promise<string>;
}

/**
 * Implementación real: pendiente de `@google-cloud/kms` (no instalada en este panel — ver
 * DESVIACIÓN arriba). Cuando se agregue la dependencia, reemplazar este cuerpo por:
 *
 *   const { KeyManagementServiceClient } = await import("@google-cloud/kms");
 *   const client = new KeyManagementServiceClient();
 *   const [pk] = await client.getPublicKey({ name: kmsKeyVersion });
 *   return pk.pem!;
 *
 * (espejo de cómo el compiler firma en signer.ts::signManifest, que usa el mismo cliente
 * inyectable `KmsClient`). `kmsKeyId` (partners.kms_key_id) queda disponible para casos en
 * los que `kmsKeyVersion` no sea ya el `name` completo de la versión.
 */
export const defaultPublicKeyFetcher: PublicKeyFetcher = {
  async getPublicKeyPem(_kmsKeyId: string, _kmsKeyVersion: string): Promise<string> {
    // TODO(PA4-W4a): instalar `@google-cloud/kms` y resolver la llave pública real vía
    // KeyManagementServiceClient.getPublicKey({ name: kmsKeyVersion }).
    throw new Error(
      "defaultPublicKeyFetcher no implementado: falta la dependencia @google-cloud/kms en multitenant-admin-panel"
    );
  },
};
