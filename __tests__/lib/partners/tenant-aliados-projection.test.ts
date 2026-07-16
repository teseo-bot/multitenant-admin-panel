// __tests__/lib/partners/tenant-aliados-projection.test.ts
// PA4-W4b-1: tests unitarios de la lógica pura (sin BD) de la proyección de contratos
// de aliado por tenant. Patrón: __tests__/lib/partners/contract-state-machine.test.ts.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  categorizeContract,
  shapeRow,
  type RawTenantAliadoJoinRow,
} from "../../../lib/partners/tenant-aliados-projection";

describe("categorizeContract", () => {
  it("active => 'vigente'", () => {
    assert.strictEqual(categorizeContract("active"), "vigente");
  });

  it("suspended => 'vigente'", () => {
    assert.strictEqual(categorizeContract("suspended"), "vigente");
  });

  it("pending_signature => 'vigente'", () => {
    assert.strictEqual(categorizeContract("pending_signature"), "vigente");
  });

  it("draft => 'vigente'", () => {
    assert.strictEqual(categorizeContract("draft"), "vigente");
  });

  it("terminated => 'historico'", () => {
    assert.strictEqual(categorizeContract("terminated"), "historico");
  });

  it("expired => 'historico'", () => {
    assert.strictEqual(categorizeContract("expired"), "historico");
  });
});

describe("shapeRow", () => {
  const RAW_ROW: RawTenantAliadoJoinRow = {
    contract_id: "11111111-1111-1111-1111-111111111111",
    partner_legal_name: "Despacho Ejemplo S.C.",
    partner_slug: "despacho-ejemplo",
    package_title: "Paquete Legal Base",
    package_slug: "legal-base",
    package_id: "22222222-2222-2222-2222-222222222222",
    version: 3,
    manifest_sha256: "a".repeat(64),
    kms_key_version: "projects/x/locations/y/keyRings/z/cryptoKeys/k/cryptoKeyVersions/1",
    kind: "direct",
    status: "active",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: "2027-01-01T00:00:00.000Z",
    derived_knowledge_clause: "client_keeps",
    scope: { systems: ["l-legal"], altitude_max: 3, modules: ["contratos"] },
    signed_by_partner: { user_id: "partner-uid-1", at: "2026-01-01T00:00:00.000Z" },
    signed_by_teseo: { user_id: "teseo-uid-1", at: "2026-01-01T00:00:00.000Z" },
    terms_sha256: "b".repeat(64),
  };

  it("no incluye campos sensibles (scope, signed_by_*, terms_sha256) en el resultado", () => {
    const result = shapeRow(RAW_ROW);
    const keys = Object.keys(result);
    assert.ok(!keys.includes("scope"), "scope no debe estar presente");
    assert.ok(!keys.includes("signed_by_partner"), "signed_by_partner no debe estar presente");
    assert.ok(!keys.includes("signed_by_teseo"), "signed_by_teseo no debe estar presente");
    assert.ok(!keys.includes("terms_sha256"), "terms_sha256 no debe estar presente");
  });

  it("mapea correctamente los campos públicos", () => {
    const result = shapeRow(RAW_ROW);
    assert.deepStrictEqual(result, {
      contract_id: "11111111-1111-1111-1111-111111111111",
      partner_legal_name: "Despacho Ejemplo S.C.",
      partner_slug: "despacho-ejemplo",
      package_title: "Paquete Legal Base",
      package_slug: "legal-base",
      package_id: "22222222-2222-2222-2222-222222222222",
      version: 3,
      manifest_sha256: "a".repeat(64),
      kms_key_version: "projects/x/locations/y/keyRings/z/cryptoKeys/k/cryptoKeyVersions/1",
      kind: "direct",
      status: "active",
      valid_from: "2026-01-01T00:00:00.000Z",
      valid_until: "2027-01-01T00:00:00.000Z",
      derived_knowledge_clause: "client_keeps",
    });
  });

  it("version/manifest_sha256/kms_key_version null cuando el paquete no tiene versión publicada", () => {
    const rowSinVersion: RawTenantAliadoJoinRow = {
      ...RAW_ROW,
      version: null,
      manifest_sha256: null,
      kms_key_version: null,
    };
    const result = shapeRow(rowSinVersion);
    assert.strictEqual(result.version, null);
    assert.strictEqual(result.manifest_sha256, null);
    assert.strictEqual(result.kms_key_version, null);
  });
});
