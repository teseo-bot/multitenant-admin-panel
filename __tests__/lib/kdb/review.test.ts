// __tests__/lib/kdb/review.test.ts
// K7-W1: tests unitarios de lib/kdb/review.ts (validación del body de review y
// armado del plan de update). Usa el runner nativo node:test (mismo patrón que
// __tests__/api/campaign-events.test.ts) porque vitest no está instalado en
// node_modules/.bin pese a existir vitest.config.ts — ver reporte de bloqueos.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  validateReviewBody,
  buildReviewUpdatePlan,
  type ExistingProposalRow,
} from "../../../lib/kdb/review";

describe("validateReviewBody", () => {
  it("rechaza decision inválida con error (422 en la ruta)", () => {
    const result = validateReviewBody({
      decision: "maybe",
      reviewer: "jorge.garcia@innoteca.mx",
    });
    assert.strictEqual(result.ok, false);
  });

  it("rechaza body sin reviewer", () => {
    const result = validateReviewBody({ decision: "approved" });
    assert.strictEqual(result.ok, false);
  });

  it("rechaza body nulo/no-objeto", () => {
    const result = validateReviewBody(null);
    assert.strictEqual(result.ok, false);
  });

  it("acepta decision approved sin corrected_content", () => {
    const result = validateReviewBody({
      decision: "approved",
      reviewer: "jorge.garcia@innoteca.mx",
    });
    assert.strictEqual(result.ok, true);
  });

  it("rechaza decision rejected sin reason (contrato: reason obligatorio al rechazar)", () => {
    const result = validateReviewBody({
      decision: "rejected",
      reviewer: "jorge.garcia@innoteca.mx",
    });
    assert.strictEqual(result.ok, false);
  });

  it("acepta decision rejected con reason >= 10 chars y la persiste en review_meta", () => {
    const result = validateReviewBody({
      decision: "rejected",
      reviewer: "jorge.garcia@innoteca.mx",
      reason: "El resumen mezcla dos clientes distintos.",
    });
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      const plan = buildReviewUpdatePlan(
        { proposal_id: "p1", new_content: "contenido", review_meta: {} },
        result.data
      );
      assert.strictEqual(plan.status, "rejected");
      assert.strictEqual(
        (plan.reviewMeta as Record<string, unknown>).rejection_reason,
        "El resumen mezcla dos clientes distintos."
      );
    }
  });

  it("acepta decision approved con corrected_content", () => {
    const result = validateReviewBody({
      decision: "approved",
      corrected_content: "---\ntype: Insight\n---\ncontenido corregido",
      reviewer: "jorge.garcia@innoteca.mx",
    });
    assert.strictEqual(result.ok, true);
  });
});

describe("buildReviewUpdatePlan", () => {
  const existing: ExistingProposalRow = {
    proposal_id: "11111111-1111-1111-1111-111111111111",
    new_content: "contenido original",
    review_meta: null,
  };

  it("approved sin corrected_content: conserva new_content y no toca review_meta.original_content", () => {
    const plan = buildReviewUpdatePlan(existing, {
      decision: "approved",
      reviewer: "ana@example.com",
    });
    assert.strictEqual(plan.status, "approved");
    assert.strictEqual(plan.newContent, "contenido original");
    assert.strictEqual((plan.reviewMeta as any).original_content, undefined);
  });

  it("approved con corrected_content: guarda original en review_meta.original_content y reemplaza new_content", () => {
    const plan = buildReviewUpdatePlan(existing, {
      decision: "approved",
      corrected_content: "contenido corregido",
      reviewer: "ana@example.com",
    });
    assert.strictEqual(plan.status, "approved");
    assert.strictEqual(plan.newContent, "contenido corregido");
    assert.strictEqual((plan.reviewMeta as any).original_content, "contenido original");
  });

  it("rejected: conserva new_content original y no modifica review_meta", () => {
    const plan = buildReviewUpdatePlan(existing, {
      decision: "rejected",
      reviewer: "ana@example.com",
    });
    assert.strictEqual(plan.status, "rejected");
    assert.strictEqual(plan.newContent, "contenido original");
  });

  it("preserva claves previas de review_meta al agregar original_content", () => {
    const existingWithMeta: ExistingProposalRow = {
      ...existing,
      review_meta: { some_prior_key: "valor" },
    };
    const plan = buildReviewUpdatePlan(existingWithMeta, {
      decision: "approved",
      corrected_content: "nuevo",
      reviewer: "ana@example.com",
    });
    assert.strictEqual((plan.reviewMeta as any).some_prior_key, "valor");
    assert.strictEqual((plan.reviewMeta as any).original_content, "contenido original");
  });
});
