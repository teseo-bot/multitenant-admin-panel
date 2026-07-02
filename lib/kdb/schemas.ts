// lib/kdb/schemas.ts
// Duplicado consciente de contracts/src/okf.ts
//
// Motivo: el panel (multitenant-admin-panel) no declara `@teseo/contracts` como
// dependencia y no existe workspace/monorepo tooling (pnpm-workspace, paths de tsconfig,
// etc.) que vincule /contracts con este repo. Además contracts/package.json fija
// `peerDependencies.zod: ^3.0.0` mientras este panel usa `zod: ^4.3.6` — importar por
// ruta relativa arriesgaría incompatibilidades de tipos entre versiones de zod.
// Se copian aquí SOLO los schemas mínimos que las rutas de app/api/kdb/ necesitan.
// Fuente canónica: /Users/teseohome/Teseo_AI/docs/okf-cerebro/TRD-OKF-Cerebro-Virtual.md §4
// y /Users/teseohome/Teseo_AI/contracts/src/okf.ts — cualquier cambio de contrato debe
// aplicarse en ambos lugares.

import { z } from "zod";

export const HOCFLIT_SYSTEMS = [
  "h-talento-humano", "o-operaciones", "c-comercial",
  "f-finanzas", "l-legal", "i-innovacion", "t-tecnologia",
] as const;
export const HocflitSystemSchema = z.enum(HOCFLIT_SYSTEMS);

export const ConceptTypeSchema = z.enum([
  "Insight", "Perfil", "Politica", "Proceso", "Metrica", "Riesgo", "Fuente",
]);

export const SourceRefSchema = z.string().regex(
  /^(conv:[\w-]+|doc:sha256:[a-f0-9]{64}|db:[\w]+:[\w-]+|url:https?:\/\/\S+)$/,
  "source-ref inválido (ver TRD §3.1)"
);

export const ConceptFrontmatterSchema = z.object({
  type: ConceptTypeSchema,
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  tags: z.array(z.string()).min(1)
    .refine((t) => (HOCFLIT_SYSTEMS as readonly string[]).includes(t[0]),
      "tags[0] debe ser un slug de sistema HOCFLIT"),
  timestamp: z.string().datetime(),
  sources: z.array(SourceRefSchema).min(1),
  confidence: z.enum(["draft", "reviewed", "consolidated"]),
  pii: z.enum(["clean", "redacted"]),
  altitude: z.number().int().min(1).max(5),
  resource: z.string().url().optional(),
});
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

export const MergeProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  target_path: z.string(),
  action: z.enum(["create", "update"]),
  altitude: z.number().int().min(1).max(5),
  draft_ids: z.array(z.string().uuid()).min(1),
  new_content: z.string(),
  previous_sha256: z.string().nullable(),
  status: z.enum(["pending_auto", "pending_hitl", "approved", "rejected", "applied"]),
});
export type MergeProposal = z.infer<typeof MergeProposalSchema>;

// Body de POST /api/kdb/[tenantId]/proposals/[proposalId]/review — TRD §9.
export const ReviewRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  corrected_content: z.string().optional(),
  reviewer: z.string().min(1),
  // Motivo de rechazo (UXUI P2: obligatorio ≥10 chars al rechazar);
  // se persiste en review_meta.rejection_reason para auditoría.
  reason: z.string().min(10).optional(),
}).refine((r) => r.decision !== "rejected" || !!r.reason, {
  message: "reason es obligatorio (≥10 chars) cuando decision es 'rejected'",
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
