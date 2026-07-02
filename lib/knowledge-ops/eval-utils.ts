// lib/knowledge-ops/eval-utils.ts
// K7-W3: Utilidades para análisis de evals (P4).
// Lógica pura, testeble: cálculo de delta scores, detección de regresión.

export interface EvalRunData {
  id: string;
  run_at: string;
  score: number;
  model_version: string;
  details: Record<string, unknown>;
}

/**
 * Calcula el delta (cambio) entre dos scores.
 * Positivo = mejora, negativo = regresión.
 */
export function calculateScoreDelta(current: number, previous: number): number {
  return current - previous;
}

/**
 * Detecta si hay regresión significativa (delta < -10).
 * Usado para mostrar banner rojo en P4 (UXUI P4).
 */
export function hasSignificantRegression(runs: EvalRunData[]): boolean {
  if (runs.length < 2) return false;
  const latest = runs[0];
  const previous = runs[1];
  const delta = calculateScoreDelta(latest.score, previous.score);
  return delta < -10;
}

/**
 * Filtra runs a los últimos 12 semanas (aprox 84 días).
 * Usado para la gráfica de línea (P4: "últimas 12 semanas").
 */
export function filterLast12Weeks(runs: EvalRunData[]): EvalRunData[] {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  return runs.filter((run) => new Date(run.run_at) >= twoWeeksAgo);
}

/**
 * Añade delta a cada run comparándolo con el anterior (UXUI P4: "Δ vs anterior").
 */
export interface EvalRunWithDelta extends EvalRunData {
  delta?: number;
}

export function enrichRunsWithDeltas(runs: EvalRunData[]): EvalRunWithDelta[] {
  return runs.map((run, idx) => {
    if (idx === 0) {
      return { ...run, delta: undefined };
    }
    const previous = runs[idx - 1];
    return { ...run, delta: calculateScoreDelta(run.score, previous.score) };
  });
}
