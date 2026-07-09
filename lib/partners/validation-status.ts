// lib/partners/validation-status.ts
// KL4-W3: función pura para determinar el estado de validación (semáforo) de un draft.
//
// - Verde (green): 0 findings con severity 'error'
// - Ámbar (amber): al menos 1 warning, 0 errores
// - Rojo (red): al menos 1 error
// - Gris (gray): no validado aún (report === undefined)

import { ValidationReport } from "./compiler-client";

export type ValidationStatus = "green" | "amber" | "red" | "gray";

/**
 * Determina el estado visual (semáforo) para un reporte de validación.
 *
 * - undefined (no validado) → "gray"
 * - 0 findings → "green"
 * - solo warns → "amber"
 * - ≥1 error → "red"
 */
export function semaforoFor(report: ValidationReport | undefined): ValidationStatus {
  if (!report) {
    return "gray";
  }

  const hasError = report.findings.some((f) => f.severity === "error");
  if (hasError) {
    return "red";
  }

  const hasWarn = report.findings.some((f) => f.severity === "warn");
  if (hasWarn) {
    return "amber";
  }

  return "green";
}

/**
 * Cuenta los errores (findings con severity 'error') en un reporte.
 */
export function countErrors(report: ValidationReport | undefined): number {
  if (!report) {
    return 0;
  }
  return report.findings.filter((f) => f.severity === "error").length;
}

/**
 * Colores CSS para cada estado. Usa variables CSS estándar del panel.
 */
export const SEMAFORO_COLORS: Record<ValidationStatus, string> = {
  green: "#22c55e", // green-500
  amber: "#f59e0b", // amber-500
  red: "#ef4444", // red-500
  gray: "#9ca3af", // gray-400
};

/**
 * Labels legibles en español.
 */
export const SEMAFORO_LABELS: Record<ValidationStatus, string> = {
  green: "Válido",
  amber: "Advertencias",
  red: "Errores",
  gray: "Sin validar",
};
