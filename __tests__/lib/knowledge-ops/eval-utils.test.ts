// __tests__/lib/knowledge-ops/eval-utils.test.ts
// K7-W3: Tests unitarios de eval-utils — lógica de scores y deltas.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  calculateScoreDelta,
  hasSignificantRegression,
  filterLast12Weeks,
  enrichRunsWithDeltas,
  type EvalRunData,
} from "../../../lib/knowledge-ops/eval-utils";

const mockRun = (score: number, daysAgo: number): EvalRunData => ({
  id: `run-${score}`,
  run_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  score,
  model_version: "v1",
  details: {},
});

describe("calculateScoreDelta", () => {
  it("calcula mejora positiva", () => {
    assert.strictEqual(calculateScoreDelta(95, 85), 10);
  });

  it("calcula regresión negativa", () => {
    assert.strictEqual(calculateScoreDelta(75, 90), -15);
  });

  it("calcula delta cero", () => {
    assert.strictEqual(calculateScoreDelta(80, 80), 0);
  });
});

describe("hasSignificantRegression", () => {
  it("detecta regresión > -10 entre corridas", () => {
    const runs: EvalRunData[] = [
      mockRun(70, 0), // más reciente
      mockRun(85, 1), // anterior
    ];
    assert.strictEqual(hasSignificantRegression(runs), true);
  });

  it("no reporta regresión si delta >= -10", () => {
    const runs: EvalRunData[] = [
      mockRun(80, 0),
      mockRun(85, 1),
    ];
    assert.strictEqual(hasSignificantRegression(runs), false);
  });

  it("retorna false si hay menos de 2 corridas", () => {
    const runs: EvalRunData[] = [mockRun(80, 0)];
    assert.strictEqual(hasSignificantRegression(runs), false);
  });

  it("retorna false si arreglo está vacío", () => {
    assert.strictEqual(hasSignificantRegression([]), false);
  });
});

describe("filterLast12Weeks", () => {
  it("mantiene corridas de las últimas 12 semanas", () => {
    const runs: EvalRunData[] = [
      mockRun(80, 7), // hace una semana
      mockRun(85, 30), // hace un mes
      mockRun(75, 84), // hace 12 semanas (límite)
      mockRun(70, 100), // hace >12 semanas (fuera)
    ];
    const filtered = filterLast12Weeks(runs);
    assert.strictEqual(filtered.length, 3);
  });

  it("retorna arreglo vacío si todas las corridas están fuera del rango", () => {
    const runs: EvalRunData[] = [
      mockRun(80, 100),
      mockRun(85, 200),
    ];
    const filtered = filterLast12Weeks(runs);
    assert.strictEqual(filtered.length, 0);
  });

  it("preserva orden original", () => {
    const runs: EvalRunData[] = [
      mockRun(85, 30),
      mockRun(80, 7),
    ];
    const filtered = filterLast12Weeks(runs);
    assert.strictEqual(filtered[0].score, 85);
    assert.strictEqual(filtered[1].score, 80);
  });
});

describe("enrichRunsWithDeltas", () => {
  it("calcula delta vs run anterior", () => {
    const runs: EvalRunData[] = [
      { ...mockRun(95, 0), id: "run1" },
      { ...mockRun(85, 1), id: "run2" },
      { ...mockRun(90, 2), id: "run3" },
    ];
    const enriched = enrichRunsWithDeltas(runs);

    assert.strictEqual(enriched[0].delta, undefined); // primer run, sin delta
    assert.strictEqual(enriched[1].delta, -10); // 85 - 95
    assert.strictEqual(enriched[2].delta, 5); // 90 - 85
  });

  it("maneja arreglo vacío", () => {
    assert.deepStrictEqual(enrichRunsWithDeltas([]), []);
  });

  it("maneja arreglo con un único run", () => {
    const runs: EvalRunData[] = [mockRun(80, 0)];
    const enriched = enrichRunsWithDeltas(runs);
    assert.strictEqual(enriched.length, 1);
    assert.strictEqual(enriched[0].delta, undefined);
  });
});
