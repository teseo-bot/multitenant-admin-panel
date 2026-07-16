// lib/partners/contract-state-machine.ts
// PA4-W1 — máquina de estados de contratos de aliado. LÓGICA PURA (sin BD).
// Fuente canónica: docs/aliados/TRD-Aliados-Conocimiento-Certificado.md §4 (línea ~296) y
// docs/aliados/WORKFLOWS-Aliados.md [INV-4.1]/[INV-4.2]/[INV-4.4].

export type ContractStatus =
  | "draft"
  | "pending_signature"
  | "active"
  | "suspended"
  | "terminated"
  | "expired";

export type TransitionClassification = "ok" | "invalid" | "needs-signatures";

/**
 * Tabla canónica de transiciones válidas (TRD §4, copiada textual):
 *   draft → pending_signature
 *   pending_signature → active   (solo con firmas+terms, ver canActivate)
 *   active → suspended
 *   suspended → active
 *   active → terminated
 *   suspended → terminated
 *   active → expired             (solo actor 'system')
 * Cualquier otro par (from→to) es inválido.
 */
export const VALID_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["pending_signature"],
  pending_signature: ["active"],
  active: ["suspended", "terminated", "expired"],
  suspended: ["active", "terminated"],
  terminated: [],
  expired: [],
};

export interface SignatureInfo {
  user_id: string;
  at: string;
}

/** Subconjunto de PartnerContract relevante para decidir si puede activarse. */
export interface ContractSignatureState {
  signed_by_partner: SignatureInfo | null;
  signed_by_teseo: SignatureInfo | null;
  terms_sha256: string | null;
}

/** TRD §4: pending_signature→active SOLO si ambas firmas y terms_sha256 están presentes. */
export function canActivate(contract: ContractSignatureState): boolean {
  return (
    contract.signed_by_partner != null &&
    contract.signed_by_teseo != null &&
    contract.terms_sha256 != null
  );
}

/**
 * Clasifica una transición propuesta from→to para el actor dado.
 *
 * - 'invalid'          → el par (from,to) no está en VALID_TRANSITIONS, o es
 *                         active→expired intentado por un actor humano/admin
 *                         (esa transición es EXCLUSIVA del actor 'system').
 *                         La ruta debe responder 409.
 * - 'needs-signatures' → SOLO pending_signature→active cuando faltan firmas o
 *                         terms_sha256. La ruta debe responder 422 (no 409).
 * - 'ok'               → la transición procede: UPDATE + evento en
 *                         partner_contract_events (misma transacción, [INV-4.4]).
 *
 * `signatures` solo es necesario quando from='pending_signature' y to='active';
 * se omite (o se ignora) para el resto de transiciones.
 */
export function classifyTransition(
  from: ContractStatus,
  to: ContractStatus,
  actor: string,
  signatures?: ContractSignatureState
): TransitionClassification {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return "invalid";
  }

  // active→expired: exclusiva del actor 'system' (TRD §4). Actor humano/admin → 409.
  if (from === "active" && to === "expired" && actor !== "system") {
    return "invalid";
  }

  // pending_signature→active: exige firmas+terms completos, si no → 422.
  if (from === "pending_signature" && to === "active") {
    if (!signatures || !canActivate(signatures)) {
      return "needs-signatures";
    }
  }

  return "ok";
}

/**
 * [INV-4.1] scope ⊆ package al crear/editar un contrato.
 *
 * NOTA — contradicción reportada (WU PA4-W1): el texto de la WU describe
 * `PartnerPackageSchema {systems[], altitude_max, modules[]}` y pide validar
 * `scope.modules ⊆ package.modules`. El schema real
 * (`contracts/src/partners.ts::PartnerPackageSchema`) y la DDL real
 * (`migrations-gcp/006_partners.sql::partner_packages`) NO tienen campo/columna
 * `modules` — solo `systems` y `altitude_max`. El INV-4.1 canónico
 * (docs/aliados/WORKFLOWS-Aliados.md:60) confirma esto: solo exige
 * `scope.systems ⊆ package.systems` y `scope.altitude_max ≤ package.altitude_max`.
 * `ContractScopeSchema.modules` son ids de `public.modules` (RBAC del TENANT, no del
 * paquete del aliado) — no hay un "package.modules" real contra el cual comparar.
 *
 * Resolución (sin inventar una columna/migración nueva, per instrucción de la WU):
 * esta función SÍ compara `scope.modules` contra `pkg.modules` cuando el llamador lo
 * provee (para que sea unit-testeable contra el enunciado literal de la WU), pero
 * `pkg.modules` es OPCIONAL — en producción, donde `pkg` viene de `partner_packages`
 * (sin columna `modules`), ese campo llega `undefined` y el check se omite
 * silenciosamente, cayendo al comportamiento canónico real (solo systems+altitude_max).
 */
export interface ScopeLike {
  systems: string[];
  altitude_max: number;
  modules: string[];
}

export interface PackageScopeLike {
  systems: string[];
  altitude_max: number;
  /** No existe en el schema/DDL real — ver nota arriba. Opcional a propósito. */
  modules?: string[];
}

export interface ScopeSubsetResult {
  ok: boolean;
  violations: string[];
}

export function scopeSubsetOfPackage(scope: ScopeLike, pkg: PackageScopeLike): ScopeSubsetResult {
  const violations: string[] = [];

  const systemsOutOfScope = scope.systems.filter((s) => !pkg.systems.includes(s));
  if (systemsOutOfScope.length > 0) {
    violations.push(`scope.systems fuera de package.systems: ${systemsOutOfScope.join(", ")}`);
  }

  if (scope.altitude_max > pkg.altitude_max) {
    violations.push(
      `scope.altitude_max (${scope.altitude_max}) excede package.altitude_max (${pkg.altitude_max})`
    );
  }

  if (pkg.modules) {
    const modulesOutOfScope = scope.modules.filter((m) => !pkg.modules!.includes(m));
    if (modulesOutOfScope.length > 0) {
      violations.push(`scope.modules fuera de package.modules: ${modulesOutOfScope.join(", ")}`);
    }
  }

  return { ok: violations.length === 0, violations };
}
