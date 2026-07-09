// lib/partners/contracts.ts
// PA4-W1 — mirror local de ContractScopeSchema + schemas de input de las rutas admin de
// contratos de aliado. `@teseo/contracts` NO es dependencia npm de este panel (ver
// lib/partners/packages.ts para el mismo patrón de mirror con comentario de origen).
//
// Origen: /Users/teseohome/Teseo_AI/contracts/src/partners.ts
// Fuente canónica: docs/aliados/TRD-Aliados-Conocimiento-Certificado.md §3.

import { z } from "zod";

// Los 7 sistemas HOCFLIT de la taxonomía del OKF (idéntico a lib/partners/packages.ts).
const HOCFLIT_SYSTEMS = [
  "h-talento-humano",
  "o-operaciones",
  "c-comercial",
  "f-finanzas",
  "l-legal",
  "i-innovacion",
  "t-tecnologia",
] as const;

/** Mirror de ContractScopeSchema (contracts/src/partners.ts). */
export const ContractScopeSchema = z.object({
  systems: z.array(z.enum(HOCFLIT_SYSTEMS)).min(1),
  altitude_max: z.number().int().min(1).max(5),
  modules: z.array(z.string().min(1)).min(1),
});
export type ContractScope = z.infer<typeof ContractScopeSchema>;

/** Mirror del sub-schema fee_model de PartnerContractSchema. */
export const ContractFeeModelSchema = z.object({
  kind: z.enum(["suscripcion", "por_uso", "incluido", "regalia"]),
  amount_mxn: z.number().nonnegative().optional(),
  period: z.enum(["mensual", "anual"]).optional(),
  royalty_share_pct: z.number().min(0).max(100).optional(),
});
export type ContractFeeModel = z.infer<typeof ContractFeeModelSchema>;

/** kind restringido a 'direct'|'marketplace' (D-P1) — cualquier otro valor → 422 vía zod. */
export const ContractKindSchema = z.enum(["direct", "marketplace"]);
export type ContractKind = z.infer<typeof ContractKindSchema>;

/** Input de POST /api/admin/partners/contracts (crear contrato). */
export const CreateContractBodySchema = z.object({
  partner_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  package_id: z.string().uuid(),
  kind: ContractKindSchema,
  scope: ContractScopeSchema,
  fee_model: ContractFeeModelSchema,
  derived_knowledge_clause: z.enum(["client_keeps", "review_on_exit"]),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
});
export type CreateContractBody = z.infer<typeof CreateContractBodySchema>;

/** Acciones de transición expuestas por la ruta admin (TRD §7.2). */
export const ContractTransitionActionSchema = z.enum(["activate", "suspend", "terminate"]);
export type ContractTransitionAction = z.infer<typeof ContractTransitionActionSchema>;

/** Input de POST /api/admin/partners/contracts/{id}/transition. */
export const TransitionContractBodySchema = z.object({
  action: ContractTransitionActionSchema,
});
export type TransitionContractBody = z.infer<typeof TransitionContractBodySchema>;
