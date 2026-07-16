// lib/partners/eval-gate.test.ts
// PA7-W2: tests unitarios de decideActivationGate (lógica pura, sin BD ni red).
// Patrón: lib/partners/catalog.test.ts (node:test co-ubicado con el módulo).

import { test } from "node:test";
import assert from "node:assert/strict";
import { decideActivationGate } from "./eval-gate";

test("primera activación + eval passed=true -> allow", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "pending_signature",
    action: "activate",
    evalStatus: { passed: true },
    override: null,
  });
  assert.equal(result.allow, true);
  assert.equal(result.blockReason, undefined);
  assert.equal(result.auditDetail, undefined);
});

test("primera activación + eval passed=false (sin override) -> block eval_gate_failed", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "pending_signature",
    action: "activate",
    evalStatus: { passed: false },
    override: null,
  });
  assert.equal(result.allow, false);
  assert.equal(result.blockReason, "eval_gate_failed");
});

test("primera activación + eval passed=false + override -> allow con auditDetail (eval_status completo)", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "pending_signature",
    action: "activate",
    evalStatus: { passed: false },
    override: { reason: "aprobado manualmente por Knowledge Ops tras revisión" },
  });
  assert.equal(result.allow, true);
  assert.ok(result.auditDetail, "debe traer auditDetail");
  assert.equal(result.auditDetail?.eval_override.reason, "aprobado manualmente por Knowledge Ops tras revisión");
  assert.deepEqual(result.auditDetail?.eval_override.eval_status, { passed: false });
});

test("evalStatus 'unavailable' sin override -> block eval_status_unavailable (fail-closed)", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "pending_signature",
    action: "activate",
    evalStatus: "unavailable",
    override: null,
  });
  assert.equal(result.allow, false);
  assert.equal(result.blockReason, "eval_status_unavailable");
});

test("evalStatus 'unavailable' + override -> allow con eval_status 'unavailable' en el auditDetail", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "pending_signature",
    action: "activate",
    evalStatus: "unavailable",
    override: { reason: "compiler caído, aprobado manualmente" },
  });
  assert.equal(result.allow, true);
  assert.equal(result.auditDetail?.eval_override.eval_status, "unavailable");
});

test("re-activación suspended->active -> allow SIN consultar (evalStatus null + from suspended)", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "suspended",
    action: "activate",
    evalStatus: null,
    override: null,
  });
  assert.equal(result.allow, true);
  assert.equal(result.blockReason, undefined);
});

test("no es la primera activación del paquete -> allow", () => {
  const result = decideActivationGate({
    isFirstActivation: false,
    from: "pending_signature",
    action: "activate",
    evalStatus: null,
    override: null,
  });
  assert.equal(result.allow, true);
});

test("acción distinta de 'activate' -> allow (el gate es ajeno a esta transición)", () => {
  const result = decideActivationGate({
    isFirstActivation: true,
    from: "active",
    action: "suspend",
    evalStatus: null,
    override: null,
  });
  assert.equal(result.allow, true);
});
