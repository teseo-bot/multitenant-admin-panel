// __tests__/lib/partners/contract-state-machine.test.ts
// PA4-W1: tests unitarios de la máquina de estados de contratos de aliado (lógica pura,
// sin BD). Patrón: __tests__/lib/partners/sources.test.ts.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  classifyTransition,
  canActivate,
  scopeSubsetOfPackage,
  VALID_TRANSITIONS,
  type ContractStatus,
  type ContractSignatureState,
} from "../../../lib/partners/contract-state-machine";
import { CreateContractBodySchema } from "../../../lib/partners/contracts";

const NO_SIGNATURES: ContractSignatureState = {
  signed_by_partner: null,
  signed_by_teseo: null,
  terms_sha256: null,
};

const FULL_SIGNATURES: ContractSignatureState = {
  signed_by_partner: { user_id: "partner-uid-1", at: "2026-07-09T00:00:00.000Z" },
  signed_by_teseo: { user_id: "teseo-uid-1", at: "2026-07-09T00:00:00.000Z" },
  terms_sha256: "a".repeat(64),
};

describe("classifyTransition", () => {
  it("draft→active (saltando pending_signature) => 'invalid' [INV-4.2]", () => {
    const result = classifyTransition("draft", "active", "admin-uid-1", FULL_SIGNATURES);
    assert.strictEqual(result, "invalid");
  });

  it("pending_signature→active sin firmas/terms => 'needs-signatures' (422)", () => {
    const result = classifyTransition("pending_signature", "active", "admin-uid-1", NO_SIGNATURES);
    assert.strictEqual(result, "needs-signatures");
  });

  it("pending_signature→active sin pasar signatures en absoluto => 'needs-signatures'", () => {
    const result = classifyTransition("pending_signature", "active", "admin-uid-1");
    assert.strictEqual(result, "needs-signatures");
  });

  it("pending_signature→active con ambas firmas + terms => 'ok'", () => {
    const result = classifyTransition("pending_signature", "active", "admin-uid-1", FULL_SIGNATURES);
    assert.strictEqual(result, "ok");
  });

  it("cada transición válida de VALID_TRANSITIONS => 'ok'", () => {
    const froms = Object.keys(VALID_TRANSITIONS) as ContractStatus[];
    for (const from of froms) {
      for (const to of VALID_TRANSITIONS[from]) {
        const actor = from === "active" && to === "expired" ? "system" : "admin-uid-1";
        const result = classifyTransition(from, to, actor, FULL_SIGNATURES);
        assert.strictEqual(
          result,
          "ok",
          `esperaba 'ok' para ${from}→${to} (actor=${actor}), obtuve '${result}'`
        );
      }
    }
  });

  it("muestra de transiciones inválidas => 'invalid'", () => {
    const invalidPairs: [ContractStatus, ContractStatus][] = [
      ["terminated", "active"],
      ["expired", "active"],
      ["draft", "terminated"],
    ];
    for (const [from, to] of invalidPairs) {
      const result = classifyTransition(from, to, "admin-uid-1", FULL_SIGNATURES);
      assert.strictEqual(result, "invalid", `esperaba 'invalid' para ${from}→${to}`);
    }
  });

  it("active→expired con actor humano => 'invalid' (409); solo 'system' puede", () => {
    const humanResult = classifyTransition("active", "expired", "admin-uid-1", FULL_SIGNATURES);
    assert.strictEqual(humanResult, "invalid");

    const systemResult = classifyTransition("active", "expired", "system", FULL_SIGNATURES);
    assert.strictEqual(systemResult, "ok");
  });
});

describe("canActivate", () => {
  it("false si falta cualquiera de las 3 condiciones", () => {
    assert.strictEqual(canActivate(NO_SIGNATURES), false);
    assert.strictEqual(
      canActivate({ ...FULL_SIGNATURES, signed_by_partner: null }),
      false
    );
    assert.strictEqual(canActivate({ ...FULL_SIGNATURES, signed_by_teseo: null }), false);
    assert.strictEqual(canActivate({ ...FULL_SIGNATURES, terms_sha256: null }), false);
  });

  it("true si las 3 condiciones están presentes", () => {
    assert.strictEqual(canActivate(FULL_SIGNATURES), true);
  });
});

describe("scopeSubsetOfPackage", () => {
  const pkg = {
    systems: ["l-legal", "f-finanzas"],
    altitude_max: 3,
    modules: ["crm", "compliance"],
  };

  it("scope.systems ⊄ package.systems => violación", () => {
    const result = scopeSubsetOfPackage(
      { systems: ["l-legal", "t-tecnologia"], altitude_max: 2, modules: ["crm"] },
      pkg
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("systems")));
  });

  it("scope.altitude_max mayor que package.altitude_max => violación", () => {
    const result = scopeSubsetOfPackage(
      { systems: ["l-legal"], altitude_max: 5, modules: ["crm"] },
      pkg
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("altitude_max")));
  });

  it("scope.modules ⊄ package.modules (cuando pkg.modules se provee) => violación", () => {
    const result = scopeSubsetOfPackage(
      { systems: ["l-legal"], altitude_max: 2, modules: ["crm", "asset-studio"] },
      pkg
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.violations.some((v) => v.includes("modules")));
  });

  it("subset perfecto => ok, sin violaciones", () => {
    const result = scopeSubsetOfPackage(
      { systems: ["l-legal"], altitude_max: 3, modules: ["crm"] },
      pkg
    );
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.violations, []);
  });

  it("pkg.modules ausente (caso real: partner_packages sin columna modules) => omite ese check", () => {
    const result = scopeSubsetOfPackage(
      { systems: ["l-legal"], altitude_max: 2, modules: ["cualquier-modulo-no-listado"] },
      { systems: ["l-legal", "f-finanzas"], altitude_max: 3 }
    );
    assert.strictEqual(result.ok, true);
  });
});

describe("CreateContractBodySchema — kind inválido", () => {
  const validBase = {
    partner_id: "550e8400-e29b-41d4-a716-446655440000",
    tenant_id: "tenant-1",
    package_id: "660e8400-e29b-41d4-a716-446655440000",
    scope: { systems: ["l-legal"], altitude_max: 2, modules: ["crm"] },
    fee_model: { kind: "incluido" },
    derived_knowledge_clause: "client_keeps",
    valid_from: "2026-07-09T00:00:00.000Z",
    valid_until: "2027-07-09T00:00:00.000Z",
  };

  it("kind='direct'|'marketplace' => success", () => {
    assert.strictEqual(
      CreateContractBodySchema.safeParse({ ...validBase, kind: "direct" }).success,
      true
    );
    assert.strictEqual(
      CreateContractBodySchema.safeParse({ ...validBase, kind: "marketplace" }).success,
      true
    );
  });

  it("kind fuera del enum => falla el safeParse", () => {
    const result = CreateContractBodySchema.safeParse({ ...validBase, kind: "reseller" });
    assert.strictEqual(result.success, false);
  });

  it("kind ausente => falla el safeParse", () => {
    const withKind = { ...validBase, kind: "direct" } as Record<string, unknown>;
    delete withKind.kind;
    const result = CreateContractBodySchema.safeParse(withKind);
    assert.strictEqual(result.success, false);
  });
});
