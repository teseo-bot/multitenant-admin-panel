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
// Dependencia `@google-cloud/kms` ^5.5.1 INSTALADA. La impl real está completa (import
// dinámico de KeyManagementServiceClient). `defaultPublicKeyFetcher.getPublicKeyPem`
// resuelve la llave pública desde Cloud KMS sin errores.

export interface PublicKeyFetcher {
  getPublicKeyPem(kmsKeyId: string, kmsKeyVersion: string): Promise<string>;
}

/**
 * Implementación real: resuelve la llave pública desde Cloud KMS usando
 * KeyManagementServiceClient.getPublicKey({ name: kmsKeyVersion }).
 *
 * (espejo de cómo el compiler firma en signer.ts::signManifest, que usa el mismo cliente
 * inyectable `KmsClient`). `kmsKeyId` (partners.kms_key_id) queda disponible para casos en
 * los que `kmsKeyVersion` no sea ya el `name` completo de la versión.
 */
export const defaultPublicKeyFetcher: PublicKeyFetcher = {
  async getPublicKeyPem(_kmsKeyId: string, kmsKeyVersion: string): Promise<string> {
    const { KeyManagementServiceClient } = await import("@google-cloud/kms");
    const client = new KeyManagementServiceClient();
    const [pk] = await client.getPublicKey({ name: kmsKeyVersion });
    return pk.pem!;
  },
};
