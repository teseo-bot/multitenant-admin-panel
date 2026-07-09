// lib/partners/license-sync.ts
// PA4-W3b — sync SÍNCRONO de licencias de aliado (lado panel) + orquestador
// transacción-con-revert [INV-7.1].
//
// Dos piezas:
//   1. `projectContractToAction` — lógica PURA: mapea un contrato de aliado (con su
//      status DESTINO ya resuelto) a la acción que debe reflejarse en
//      `kdb_partner_licenses` (lado compiler, PA4-W3a). Sin BD, unit-testeable.
//   2. `applyTransitionWithSync` — orquestador testeable: aplica la transición de
//      status (UPDATE + evento) y, si la transición afecta visibilidad, sincroniza la
//      licencia contra el compiler DENTRO de la misma transacción lógica. Si el sync
//      falla, revierte el UPDATE ([INV-7.1]: la fila de licencia y el status del panel
//      nunca quedan desincronizados — o ambos avanzan, o ninguno).
//
// `tx` y `syncFn` se inyectan (interfaces `TxLike` / `LicenseSyncFn`) para que el
// orquestador sea testeable con dobles de prueba sin BD real (ver
// __tests__/lib/partners/license-sync.test.ts). El wiring real (app/api/admin/partners/
// contracts/[id]/transition/route.ts, app/api/*/contracts/[id]/sign/route.ts,
// scripts/expire-contracts.ts) construye `tx` sobre un cliente `pg` real vía
// `createPoolClientTx`.

import type { PoolClient } from "pg";
import {
  syncPartnerLicenseViaCompiler,
  type PartnerLicenseInput,
  type PartnerLicenseSyncInput,
} from "@/lib/partners/compiler-client";
import type { ContractStatus } from "@/lib/partners/contract-state-machine";

// ---------------------------------------------------------------------------
// 1. projectContractToAction (PURA)
// ---------------------------------------------------------------------------

/** Subconjunto de PartnerContract necesario para proyectar la fila de licencia. Los
 * campos vienen del contrato + su `scope` (systems/altitude_max/modules) + `version`
 * del paquete publicado asociado (partner_package_versions, resuelto por el caller —
 * NO existe columna `version` en partner_contracts ni en partner_packages, ver
 * migrations-gcp/006_partners.sql/007_partner_contracts.sql). `status` es el status
 * DESTINO de la transición (el contrato "ya aterrizado" en el nuevo estado). */
export interface ContractForLicenseProjection {
  id: string;
  tenant_id: string;
  partner_id: string;
  package_id: string;
  version: number;
  scope: {
    systems: string[];
    altitude_max: number;
    modules: string[];
  };
  valid_from: string;
  valid_until: string;
  status: ContractStatus;
}

/**
 * Mapeo por status destino (WU PA4-W3b):
 *   'active'    → upsert, license.status='active'
 *   'suspended' → upsert, license.status='suspended'
 *   'terminated'→ delete
 *   'expired'   → delete
 *
 * Cualquier otro status ('draft'|'pending_signature') no forma parte del dominio
 * documentado de esta función — no tocan visibilidad y `applyTransitionWithSync` nunca
 * la invoca para esos destinos (ver VISIBILITY_STATUSES abajo). Por defensividad se
 * tratan como 'delete' (no dejar una fila de licencia fantasma), pero esta rama no
 * debería alcanzarse en producción.
 */
export function projectContractToAction(
  contract: ContractForLicenseProjection
): PartnerLicenseSyncInput {
  switch (contract.status) {
    case "active":
    case "suspended": {
      const license: PartnerLicenseInput = {
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        partner_id: contract.partner_id,
        package_id: contract.package_id,
        version: contract.version,
        systems: contract.scope.systems,
        altitude_max: contract.scope.altitude_max,
        modules: contract.scope.modules,
        valid_from: contract.valid_from,
        valid_until: contract.valid_until,
        status: contract.status,
      };
      return { action: "upsert", contract_id: contract.id, license };
    }
    case "terminated":
    case "expired":
    default:
      return { action: "delete", contract_id: contract.id };
  }
}

/** `syncFn` inyectable: llama al compiler. Implementación real de producción. */
export async function syncLicenseToCompiler(input: PartnerLicenseSyncInput): Promise<void> {
  await syncPartnerLicenseViaCompiler(input);
}

export type LicenseSyncFn = (input: PartnerLicenseSyncInput) => Promise<void>;

// ---------------------------------------------------------------------------
// 2. applyTransitionWithSync (orquestador testeable) [INV-7.1]
// ---------------------------------------------------------------------------

/** Transiciones destino que afectan visibilidad de la licencia (deben sincronizar). Las
 * demás (p.ej. draft→pending_signature) NO llaman a `syncFn`. */
const VISIBILITY_STATUSES: ReadonlySet<ContractStatus> = new Set<ContractStatus>([
  "active",
  "suspended",
  "terminated",
  "expired",
]);

/** Interfaz mínima de transacción inyectable — implementada en producción sobre un
 * `pg.PoolClient` (ver `createPoolClientTx`), y con un doble de prueba en los tests
 * (registra la secuencia de llamadas begin/query/commit/rollback). */
export interface TxLike {
  begin(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** Se lanza cuando `syncFn` falla: el UPDATE de status YA fue revertido (rollback) y la
 * transición NO persiste. El caller (rutas) debe mapear esto a 502. */
export class LicenseSyncError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "LicenseSyncError";
    this.cause = cause;
  }
}

/** Se lanza cuando el UPDATE con guard `AND status=<from>` no afecta ninguna fila (el
 * contrato cambió de estado concurrentemente entre la lectura y el UPDATE). El caller
 * debe mapear esto a 409, mismo comportamiento que la implementación manual previa en
 * transition/route.ts. NO forma parte del enunciado literal de la WU (que solo describe
 * begin→UPDATE→INSERT→sync→commit/rollback) — se añade porque la guardia `AND
 * status=<from>` mencionada explícitamente en la WU sólo tiene sentido si su resultado
 * se verifica; el check usa `rowCount` (siempre numérico en `pg` real) y se omite
 * silenciosamente si el doble de prueba no lo define, para no interferir con los tests
 * descritos (happy path / sync-falla / sin-sync-si-no-toca-visibilidad).
 */
export class ConcurrentTransitionError extends Error {
  constructor(contractId: string, from: ContractStatus, to: ContractStatus) {
    super(
      `El contrato ${contractId} cambió de estado concurrentemente (esperado from=${from}, to=${to}), reintenta`
    );
    this.name = "ConcurrentTransitionError";
  }
}

export interface ApplyTransitionWithSyncParams {
  tx: TxLike;
  syncFn: LicenseSyncFn;
  /** Contrato en su estado ORIGEN (contract.status = `from`), incluyendo `version` y
   * `scope` ya resueltos por el caller (JOIN con partner_package_versions hecho ANTES de
   * llamar — ver nota en ContractForLicenseProjection). */
  contract: ContractForLicenseProjection;
  /** Status destino de la transición. */
  to: ContractStatus;
  /** actor para partner_contract_events ('system' o user_id del admin/partner). */
  actor: string;
  /** detail (JSONB) para partner_contract_events — el caller arma el objeto completo
   * (p.ej. {from, to, action} o {from, to, action:'auto_activate'}). */
  eventDetail: Record<string, unknown>;
}

/**
 * Flujo [INV-7.1]:
 *   begin() → UPDATE status (guard AND status=<from>) → INSERT partner_contract_events
 *   → (si `to` toca visibilidad) await syncFn(projectContractToAction(contratoDestino))
 *   → si TODO ok: commit(); si syncFn lanza: rollback() y re-lanza LicenseSyncError
 *   (la transición NO persiste).
 *
 * El orden importa: la fila de licencia (visibilidad) solo queda firme si el panel
 * TAMBIÉN commitea su UPDATE de status — un fallo de sync deja el contrato SIN cambiar
 * de estado, nunca "medio migrado".
 */
export async function applyTransitionWithSync(params: ApplyTransitionWithSyncParams): Promise<void> {
  const { tx, syncFn, contract, to, actor, eventDetail } = params;
  const from = contract.status;

  await tx.begin();

  const updateResult = await tx.query(
    `UPDATE partner_contracts SET status = $1 WHERE id = $2 AND status = $3`,
    [to, contract.id, from]
  );

  if (typeof updateResult.rowCount === "number" && updateResult.rowCount === 0) {
    await tx.rollback();
    throw new ConcurrentTransitionError(contract.id, from, to);
  }

  await tx.query(
    `INSERT INTO partner_contract_events (contract_id, event, actor, detail)
     VALUES ($1, 'status_changed', $2, $3)`,
    [contract.id, actor, JSON.stringify(eventDetail)]
  );

  if (VISIBILITY_STATUSES.has(to)) {
    const contractDestino: ContractForLicenseProjection = { ...contract, status: to };
    const action = projectContractToAction(contractDestino);
    try {
      await syncFn(action);
    } catch (err) {
      await tx.rollback();
      throw new LicenseSyncError(
        "Fallo al sincronizar la licencia con el compiler; la transición de contrato no se persistió.",
        err
      );
    }
  }

  await tx.commit();
}

// ---------------------------------------------------------------------------
// Adaptador de producción: TxLike sobre un pg.PoolClient real.
// ---------------------------------------------------------------------------

/** Envuelve un `PoolClient` (de `pool.connect()`) en la interfaz `TxLike`. Reusado por
 * las rutas de transición/firma y por scripts/expire-contracts.ts para no duplicar el
 * mapeo BEGIN/COMMIT/ROLLBACK en cada wiring. */
export function createPoolClientTx(client: PoolClient): TxLike {
  return {
    async begin() {
      await client.query("BEGIN");
    },
    async query(sql: string, params?: unknown[]) {
      return client.query(sql, params);
    },
    async commit() {
      await client.query("COMMIT");
    },
    async rollback() {
      await client.query("ROLLBACK");
    },
  };
}
