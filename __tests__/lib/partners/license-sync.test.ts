// __tests__/lib/partners/license-sync.test.ts
// PA4-W3b: tests unitarios de license-sync.ts (lógica pura + orquestador
// applyTransitionWithSync [INV-7.1]), sin BD real. Patrón:
// __tests__/lib/partners/contract-state-machine.test.ts.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  projectContractToAction,
  applyTransitionWithSync,
  LicenseSyncError,
  type ContractForLicenseProjection,
  type TxLike,
} from "../../../lib/partners/license-sync";

const BASE_CONTRACT: Omit<ContractForLicenseProjection, "status"> = {
  id: "11111111-1111-1111-1111-111111111111",
  tenant_id: "tenant-demo",
  partner_id: "22222222-2222-2222-2222-222222222222",
  package_id: "33333333-3333-3333-3333-333333333333",
  version: 2,
  scope: {
    systems: ["l-legal", "f-finanzas"],
    altitude_max: 3,
    modules: ["mod-a", "mod-b"],
  },
  valid_from: "2026-01-01T00:00:00.000Z",
  valid_until: "2027-01-01T00:00:00.000Z",
};

describe("projectContractToAction", () => {
  it("status='active' => upsert con license.status='active' y systems/altitude_max/modules del scope", () => {
    const result = projectContractToAction({ ...BASE_CONTRACT, status: "active" });
    assert.strictEqual(result.action, "upsert");
    assert.strictEqual(result.contract_id, BASE_CONTRACT.id);
    assert.ok("license" in result);
    if (result.action === "upsert") {
      assert.strictEqual(result.license.status, "active");
      assert.deepStrictEqual(result.license.systems, BASE_CONTRACT.scope.systems);
      assert.strictEqual(result.license.altitude_max, BASE_CONTRACT.scope.altitude_max);
      assert.deepStrictEqual(result.license.modules, BASE_CONTRACT.scope.modules);
      assert.strictEqual(result.license.version, BASE_CONTRACT.version);
      assert.strictEqual(result.license.tenant_id, BASE_CONTRACT.tenant_id);
      assert.strictEqual(result.license.partner_id, BASE_CONTRACT.partner_id);
      assert.strictEqual(result.license.package_id, BASE_CONTRACT.package_id);
      assert.strictEqual(result.license.valid_from, BASE_CONTRACT.valid_from);
      assert.strictEqual(result.license.valid_until, BASE_CONTRACT.valid_until);
    }
  });

  // PA5-W2-followup: los 4 campos de presentación (partner_slug/partner_legal_name/
  // package_slug/package_title) resueltos por el caller (JOIN/subquery contra
  // partners/partner_packages) deben reenviarse tal cual en el `license` proyectado.
  it("status='active' con campos de presentación => se reenvían en license", () => {
    const result = projectContractToAction({
      ...BASE_CONTRACT,
      status: "active",
      partner_slug: "aliado-legal-1",
      partner_legal_name: "Aliado Legal Uno S.A. de C.V.",
      package_slug: "paquete-fiscal",
      package_title: "Paquete Fiscal Corporativo",
    });
    assert.strictEqual(result.action, "upsert");
    if (result.action === "upsert") {
      assert.strictEqual(result.license.partner_slug, "aliado-legal-1");
      assert.strictEqual(result.license.partner_legal_name, "Aliado Legal Uno S.A. de C.V.");
      assert.strictEqual(result.license.package_slug, "paquete-fiscal");
      assert.strictEqual(result.license.package_title, "Paquete Fiscal Corporativo");
    }
  });

  it("status='suspended' => upsert con license.status='suspended'", () => {
    const result = projectContractToAction({ ...BASE_CONTRACT, status: "suspended" });
    assert.strictEqual(result.action, "upsert");
    if (result.action === "upsert") {
      assert.strictEqual(result.license.status, "suspended");
    }
  });

  it("status='terminated' => 'delete' (sin license)", () => {
    const result = projectContractToAction({ ...BASE_CONTRACT, status: "terminated" });
    assert.strictEqual(result.action, "delete");
    assert.strictEqual(result.contract_id, BASE_CONTRACT.id);
    assert.strictEqual((result as any).license, undefined);
  });

  it("status='expired' => 'delete' (sin license)", () => {
    const result = projectContractToAction({ ...BASE_CONTRACT, status: "expired" });
    assert.strictEqual(result.action, "delete");
    assert.strictEqual((result as any).license, undefined);
  });
});

// --- Doble de prueba de TxLike: registra la secuencia de llamadas. --------------------

function makeFakeTx(sharedCalls: string[]) {
  const tx: TxLike = {
    async begin() {
      sharedCalls.push("begin");
    },
    async query(sql: string) {
      if (/^\s*UPDATE partner_contracts/.test(sql)) {
        sharedCalls.push("UPDATE");
        return { rows: [{}], rowCount: 1 };
      }
      if (/^\s*INSERT INTO partner_contract_events/.test(sql)) {
        sharedCalls.push("INSERT");
        return { rows: [], rowCount: 1 };
      }
      sharedCalls.push("query:unknown");
      return { rows: [], rowCount: 0 };
    },
    async commit() {
      sharedCalls.push("commit");
    },
    async rollback() {
      sharedCalls.push("rollback");
    },
  };
  return tx;
}

describe("applyTransitionWithSync", () => {
  it("happy path (syncFn resuelve): begin, UPDATE, INSERT, sync, commit — NUNCA rollback", async () => {
    const calls: string[] = [];
    const tx = makeFakeTx(calls);
    const syncFn = async () => {
      calls.push("sync");
    };

    await applyTransitionWithSync({
      tx,
      syncFn,
      contract: { ...BASE_CONTRACT, status: "pending_signature" },
      to: "active",
      actor: "admin-uid-1",
      eventDetail: { from: "pending_signature", to: "active", action: "activate" },
    });

    assert.deepStrictEqual(calls, ["begin", "UPDATE", "INSERT", "sync", "commit"]);
    assert.ok(!calls.includes("rollback"), "no debe haber rollback en el happy path");
  });

  it("[INV-7.1] sync caído (syncFn rechaza) => rollback, NUNCA commit, se propaga LicenseSyncError", async () => {
    const calls: string[] = [];
    const tx = makeFakeTx(calls);
    const syncError = new Error("compiler unreachable");
    const syncFn = async () => {
      calls.push("sync");
      throw syncError;
    };

    await assert.rejects(
      () =>
        applyTransitionWithSync({
          tx,
          syncFn,
          contract: { ...BASE_CONTRACT, status: "active" },
          to: "suspended",
          actor: "admin-uid-1",
          eventDetail: { from: "active", to: "suspended", action: "suspend" },
        }),
      (err: unknown) => {
        assert.ok(err instanceof LicenseSyncError, "debe lanzar LicenseSyncError");
        assert.strictEqual((err as LicenseSyncError).cause, syncError);
        return true;
      }
    );

    assert.deepStrictEqual(calls, ["begin", "UPDATE", "INSERT", "sync", "rollback"]);
    assert.ok(!calls.includes("commit"), "NUNCA debe commitear si syncFn rechaza");
  });

  it("transición que NO toca visibilidad (draft→pending_signature) => syncFn NO se invoca", async () => {
    const calls: string[] = [];
    const tx = makeFakeTx(calls);
    let syncCalled = false;
    const syncFn = async () => {
      syncCalled = true;
    };

    await applyTransitionWithSync({
      tx,
      syncFn,
      contract: { ...BASE_CONTRACT, status: "draft" },
      to: "pending_signature",
      actor: "admin-uid-1",
      eventDetail: { from: "draft", to: "pending_signature", action: "submit" },
    });

    assert.strictEqual(syncCalled, false, "syncFn no debe invocarse para transiciones que no tocan visibilidad");
    assert.deepStrictEqual(calls, ["begin", "UPDATE", "INSERT", "commit"]);
  });
});
