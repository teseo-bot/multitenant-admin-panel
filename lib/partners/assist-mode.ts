// lib/partners/assist-mode.ts
// KL4-W2: lógica pura para decidir el mode del asistente según el estado de validación.
//
// Extraída del componente para poder testearse sin React.

import type { ValidationReport } from "./compiler-client";

/**
 * Decide el mode del asistente según si hay findings con error.
 * - Si hay findings con severidad 'error': mode='fix_findings'
 * - Si no hay errores: mode='reorganize'
 *
 * Esta es una decisión pura que solo depende del report.
 */
export function decidAssistMode(report: ValidationReport | null): "fix_findings" | "reorganize" {
  if (!report) {
    return "reorganize";
  }
  const hasActiveErrors = report.findings.some((f) => f.severity === "error");
  return hasActiveErrors ? "fix_findings" : "reorganize";
}
