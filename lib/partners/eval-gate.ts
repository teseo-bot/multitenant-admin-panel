// lib/partners/eval-gate.ts
// PA7-W2 — decisión PURA (sin BD, sin fetch) del gate de eval de paquete que bloquea la
// PRIMERA activación de un contrato de aliado (TRD-Aliados-Conocimiento-Certificado.md).
//
// Regla de producto: antes de activar el PRIMER contrato de un paquete, el paquete debe
// haber probado calidad (>=10 preguntas doradas + eval con score >=80 — decidido del lado
// compiler, ver context-kdb-compiler/src/partners/eval-gate.ts, misma definición de
// "passed"). Score insuficiente o servicio de eval caído bloquean la activación SALVO
// override manual de Knowledge Ops, que queda auditado (`auditDetail`).
//
// Esta función NO hace I/O — las rutas (app/api/admin/partners/contracts/[id]/transition/
// route.ts y los dos sign/route.ts de auto-activación) resuelven `isFirstActivation` (query
// SQL) y `evalStatus` (llamada a lib/partners/compiler-client.ts::getPackageEvalStatus) y
// SOLO orquestan I/O; toda la lógica de "¿se bloquea o no?" vive aquí, unit-testeable sin BD
// ni red (lib/partners/eval-gate.test.ts).

import type { ContractStatus } from "./contract-state-machine";

export interface DecideActivationGateInput {
  /** true si NINGÚN otro contrato del mismo package_id tiene status NOT IN
   * ('draft','pending_signature') — es decir, el paquete nunca se activó antes. */
  isFirstActivation: boolean;
  /** Status ORIGEN de la transición ('pending_signature' o 'suspended', las únicas dos
   * que llevan a 'active' en VALID_TRANSITIONS). */
  from: ContractStatus;
  /** Acción de la transición tal como la expone la ruta (solo 'activate' dispara el gate;
   * cualquier otra acción se deja pasar sin evaluar, defensivamente). */
  action: string;
  /** Resultado de consultar el gate de eval del paquete vía el compiler.
   *  - `{passed: boolean}`: el compiler respondió (ver src/partners/eval-gate.ts, compiler).
   *  - `'unavailable'`: el compiler no respondió (CompilerCallError) — fail-closed.
   *  - `null`: no se consultó (p.ej. porque el gate no aplica a esta transición). */
  evalStatus: { passed: boolean } | "unavailable" | null;
  /** Override manual de Knowledge Ops. Si está presente Y el gate bloquearía, se permite
   * de todas formas y se registra `auditDetail` con la razón + el estado de eval. */
  override: { reason: string } | null;
}

export interface DecideActivationGateResult {
  allow: boolean;
  /** Motivo del bloqueo, solo si allow=false. 'eval_gate_failed' (score/preguntas
   * insuficientes) o 'eval_status_unavailable' (el compiler no respondió). */
  blockReason?: "eval_gate_failed" | "eval_status_unavailable";
  /** Detalle a persistir en el evento auditado (partner_contract_events.detail) cuando hubo
   * override — SIEMPRE incluye el eval_status completo, el override NO desactiva el chequeo,
   * solo lo deja pasar con constancia auditada. */
  auditDetail?: { eval_override: { reason: string; eval_status: { passed: boolean } | "unavailable" | null } };
}

export function decideActivationGate(input: DecideActivationGateInput): DecideActivationGateResult {
  const { isFirstActivation, from, action, evalStatus, override } = input;

  // Cualquier acción que no sea 'activate' es ajena al dominio de este gate.
  if (action !== "activate") {
    return { allow: true };
  }

  // Re-activación suspended→active: el gate NUNCA aplica (ni siquiera se consulta eval —
  // el caller no debe llamar a esta función con evalStatus distinto de null en este caso).
  if (from === "suspended") {
    return { allow: true };
  }

  // No es la primera activación del paquete: ya probó calidad en una activación anterior.
  if (!isFirstActivation) {
    return { allow: true };
  }

  const passed = evalStatus !== null && evalStatus !== "unavailable" && evalStatus.passed === true;

  if (passed) {
    return { allow: true };
  }

  if (override) {
    return {
      allow: true,
      auditDetail: { eval_override: { reason: override.reason, eval_status: evalStatus } },
    };
  }

  return {
    allow: false,
    blockReason: evalStatus === "unavailable" ? "eval_status_unavailable" : "eval_gate_failed",
  };
}
