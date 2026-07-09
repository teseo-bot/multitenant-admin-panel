// __tests__/lib/partners/manifest-verify.test.ts
// PA4-W4a: tests unitarios del módulo PURO de verificación de manifiestos (sin BD, sin KMS).
// Patrón: __tests__/lib/partners/contract-otp.test.ts (describe/it de node:test). Firma
// local con un par de llaves EC efímero (P-256) simulando la firma que hace Cloud KMS —
// mismo patrón que context-kdb-compiler/src/partners/signer.test.ts.

import { describe, it } from "node:test";
import assert from "node:assert";
import { createSign, createHash, generateKeyPairSync } from "node:crypto";
import { canonicalize, verifyManifest } from "../../../lib/partners/manifest-verify";

function makeKeyPair() {
  return generateKeyPairSync("ec", {
    namedCurve: "prime256v1", // P-256
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function signCanonical(canonical: string, privateKey: string): string {
  const signer = createSign("sha256");
  signer.update(canonical, "utf-8");
  return signer.sign(privateKey, "base64");
}

function shaHex(canonical: string): string {
  return createHash("sha256").update(canonical, "utf-8").digest("hex");
}

describe("canonicalize", () => {
  it("es estable ante distinto orden de claves de entrada", () => {
    const obj1 = { z: 1, a: 2, m: { b: 3, x: 4 } };
    const obj2 = { a: 2, z: 1, m: { x: 4, b: 3 } };

    assert.strictEqual(canonicalize(obj1), canonicalize(obj2));
  });

  it("excluye los campos de firma (manifest_sha256, signature_b64, kms_key_version)", () => {
    const withSignature = {
      package_id: "pkg-123",
      version: 1,
      manifest_sha256: "abc123",
      signature_b64: "def456",
      kms_key_version: "v1",
    };
    const without = { package_id: "pkg-123", version: 1 };

    assert.strictEqual(canonicalize(withSignature), canonicalize(without));
  });

  it("termina con LF", () => {
    assert.ok(canonicalize({ a: 1 }).endsWith("\n"));
  });
});

describe("verifyManifest", () => {
  it("manifest bien firmado + llave pública correcta → 'verified'", () => {
    const { privateKey, publicKey } = makeKeyPair();

    const manifest = {
      package_id: "550e8400-e29b-41d4-a716-446655440001",
      package_slug: "contratos-mercantiles",
      version: 1,
      concepts: [{ path: "@bufete/l-legal/clausula.md", sha256: "abc123" }],
    };

    const canonical = canonicalize(manifest);
    const signature_b64 = signCanonical(canonical, privateKey);
    const manifest_sha256 = shaHex(canonical);

    const signedManifest = {
      ...manifest,
      manifest_sha256,
      signature_b64,
      kms_key_version: "projects/test/locations/us-central1/keyRings/test/cryptoKeys/test/versions/1",
    };

    assert.strictEqual(verifyManifest(signedManifest, publicKey), "verified");
  });

  it("alterar 1 byte del manifest → 'unverified'", () => {
    const { privateKey, publicKey } = makeKeyPair();

    const manifest = {
      package_id: "550e8400-e29b-41d4-a716-446655440001",
      concepts: [{ path: "@bufete/l-legal/clausula.md", sha256: "abc123" }],
    };

    const canonical = canonicalize(manifest);
    const signature_b64 = signCanonical(canonical, privateKey);
    const manifest_sha256 = shaHex(canonical);

    const signedManifest = {
      ...manifest,
      manifest_sha256,
      signature_b64,
      kms_key_version: "v1",
    };

    // Un solo carácter alterado en un campo del manifiesto (contenido cambia, sha256 firmado
    // se queda con el valor original).
    const tampered = {
      ...signedManifest,
      concepts: [{ path: "@bufete/l-legal/clausula-MODIFICADA.md", sha256: "abc123" }],
    };

    assert.strictEqual(verifyManifest(tampered, publicKey), "unverified");
  });

  it("alterar 1 byte del manifest_sha256 → 'unverified'", () => {
    const { privateKey, publicKey } = makeKeyPair();

    const manifest = {
      package_id: "550e8400-e29b-41d4-a716-446655440001",
      concepts: [{ path: "@bufete/l-legal/clausula.md", sha256: "abc123" }],
    };

    const canonical = canonicalize(manifest);
    const signature_b64 = signCanonical(canonical, privateKey);
    const manifest_sha256 = shaHex(canonical);

    const tamperedSha = manifest_sha256.slice(0, -1) + (manifest_sha256.endsWith("0") ? "1" : "0");

    const signedManifest = {
      ...manifest,
      manifest_sha256: tamperedSha,
      signature_b64,
      kms_key_version: "v1",
    };

    assert.strictEqual(verifyManifest(signedManifest, publicKey), "unverified");
  });

  it("llave pública incorrecta → 'unverified'", () => {
    const { privateKey } = makeKeyPair();
    const { publicKey: otherPublicKey } = makeKeyPair();

    const manifest = {
      package_id: "550e8400-e29b-41d4-a716-446655440001",
      concepts: [{ path: "@bufete/l-legal/clausula.md", sha256: "abc123" }],
    };

    const canonical = canonicalize(manifest);
    const signature_b64 = signCanonical(canonical, privateKey);
    const manifest_sha256 = shaHex(canonical);

    const signedManifest = {
      ...manifest,
      manifest_sha256,
      signature_b64,
      kms_key_version: "v1",
    };

    assert.strictEqual(verifyManifest(signedManifest, otherPublicKey), "unverified");
  });

  it("falta signature_b64 → 'unverified'", () => {
    const { publicKey } = makeKeyPair();

    const manifest = {
      package_id: "550e8400-e29b-41d4-a716-446655440001",
      manifest_sha256: "abc123",
      kms_key_version: "v1",
    };

    assert.strictEqual(verifyManifest(manifest, publicKey), "unverified");
  });
});
