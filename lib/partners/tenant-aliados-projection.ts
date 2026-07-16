// lib/partners/tenant-aliados-projection.ts
// PA4-W4b-1 — lógica pura (sin BD) para el endpoint interno S2S
// GET /api/internal/tenant/aliados, que el tenant-admin-panel (otro repo, plano tenant)
// consumirá para mostrarle al tenant sus contratos de aliado (partner_contracts vive en
// el control-plane; aislamiento de planos, decisión del CEO).
//
// Dos funciones puras:
//   - categorizeContract: clasifica un status de contrato en 'vigente' | 'historico'
//     (usado por la ruta para el criterio de orden: vigentes primero).
//   - shapeRow: mapea una fila cruda del JOIN (que puede traer columnas sensibles:
//     scope, signed_by_partner, signed_by_teseo, terms_sha256) al shape público
//     TenantAliadoContractRow, dejando esas columnas fuera [RP-PA-11].

import type { ContractStatus } from "./contract-state-machine";

export type ContractCategory = "vigente" | "historico";

/** [INV-7.4]: todos los estados se devuelven; esta categoría solo determina el orden. */
const VIGENTE_STATUSES: ReadonlySet<ContractStatus> = new Set<ContractStatus>([
  "active",
  "suspended",
  "pending_signature",
  "draft",
]);

export function categorizeContract(status: ContractStatus): ContractCategory {
  return VIGENTE_STATUSES.has(status) ? "vigente" : "historico";
}

/**
 * Shape público devuelto por GET /api/internal/tenant/aliados.
 * NO incluye scope completo ni campos de firma internos (signed_by_*, terms_sha256) —
 * el tenant-panel debe espejar exactamente este tipo.
 */
export interface TenantAliadoContractRow {
  contract_id: string;
  partner_legal_name: string;
  partner_slug: string;
  package_title: string;
  package_slug: string;
  package_id: string;
  version: number | null;
  manifest_sha256: string | null;
  kms_key_version: string | null;
  kind: string;
  status: ContractStatus;
  valid_from: string;
  valid_until: string;
  derived_knowledge_clause: string;
}

/**
 * Fila cruda tal como la devuelve el JOIN (SELECT explícito de las columnas necesarias
 * más, potencialmente, columnas sensibles de partner_contracts si el caller las incluyó
 * por error — shapeRow las descarta de cualquier forma al construir el objeto de salida
 * campo por campo, nunca por spread).
 */
export interface RawTenantAliadoJoinRow {
  contract_id: string;
  partner_legal_name: string;
  partner_slug: string;
  package_title: string;
  package_slug: string;
  package_id: string;
  version: number | null;
  manifest_sha256: string | null;
  kms_key_version: string | null;
  kind: string;
  status: ContractStatus;
  valid_from: string | Date;
  valid_until: string | Date;
  derived_knowledge_clause: string;
  // Campos que pueden venir presentes en la fila cruda (p.ej. si el query los selecciona
  // por error) pero que shapeRow NUNCA debe reflejar en la salida.
  scope?: unknown;
  signed_by_partner?: unknown;
  signed_by_teseo?: unknown;
  terms_sha256?: unknown;
}

export function shapeRow(dbRow: RawTenantAliadoJoinRow): TenantAliadoContractRow {
  return {
    contract_id: dbRow.contract_id,
    partner_legal_name: dbRow.partner_legal_name,
    partner_slug: dbRow.partner_slug,
    package_title: dbRow.package_title,
    package_slug: dbRow.package_slug,
    package_id: dbRow.package_id,
    version: dbRow.version ?? null,
    manifest_sha256: dbRow.manifest_sha256 ?? null,
    kms_key_version: dbRow.kms_key_version ?? null,
    kind: dbRow.kind,
    status: dbRow.status,
    valid_from: new Date(dbRow.valid_from).toISOString(),
    valid_until: new Date(dbRow.valid_until).toISOString(),
    derived_knowledge_clause: dbRow.derived_knowledge_clause,
  };
}
