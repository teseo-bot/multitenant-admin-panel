// lib/partners/assist.ts
// KL3-W2 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §3.3): esquema y lógica de
// pertenencia para el proxy del asistente IA (`POST /api/partners/me/assist`).
//
// `resolveSourceGcsObjects` está extraída de la ruta (igual que packages.ts/sources.ts) para
// poder testearla sin invocar `pool.query` real: la ruta inyecta `pool.query` tal cual, los
// tests inyectan un stub. Regla dura (RP-KL7): cualquier `source_id` ausente o de OTRO partner
// → 403 (nunca se revela si existe pero es ajeno, ni se filtra en silencio).

import { z } from "zod";

export const AssistModeSchema = z.enum(["draft_from_source", "reorganize", "fix_findings"]);
export type AssistMode = z.infer<typeof AssistModeSchema>;

/** Espejo laxo de ValidationFinding (context-kdb-compiler/src/partners/validator.ts) — el panel
 * solo reenvía estos objetos al compiler tal cual, no los interpreta. */
export const AssistFindingSchema = z.object({
  rule_id: z.string(),
  level: z.enum(["n1", "n2", "n3"]),
  severity: z.enum(["error", "warn"]),
  message_es: z.string(),
  line: z.number().optional(),
  fix: z
    .object({
      kind: z.enum(["set_field", "replace_text"]),
      description_es: z.string(),
      value: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
});

export const AssistBodySchema = z.object({
  mode: AssistModeSchema,
  markdown: z.string().min(1).optional(),
  source_ids: z.array(z.string().uuid()).optional(),
  findings: z.array(AssistFindingSchema).optional(),
  concept_type: z.string().optional(),
  system: z.string().optional(),
});

export type AssistBody = z.infer<typeof AssistBodySchema>;

export interface PartnerSourceForAssist {
  id: string;
  kind: "doc" | "url";
  gcs_object: string | null;
}

export type ResolveSourcesResult =
  | { ok: true; gcs_objects: string[] }
  | { ok: false; status: 403 | 422; error: string };

/**
 * Verifica que TODOS los `sourceIds` pertenezcan a `partnerId` (RP-KL7) y los mapea a
 * `source_gcs_object` para el proxy al compiler. Solo `kind:'doc'` está soportado en v1 (las
 * URLs no tienen objeto en `_fuentes/` que el compiler pueda leer) — 422 si alguno es `url`.
 * Cualquier id ausente o de otro partner → 403 (no se distingue "no existe" de "es de otro
 * aliado": ambos casos deben verse igual desde afuera).
 */
export async function resolveSourceGcsObjects(
  sourceIds: string[],
  partnerId: string,
  query: (text: string, params: unknown[]) => Promise<{ rows: PartnerSourceForAssist[] }>
): Promise<ResolveSourcesResult> {
  const { rows } = await query(
    `SELECT id, kind, gcs_object FROM partner_sources WHERE id = ANY($1) AND partner_id = $2`,
    [sourceIds, partnerId]
  );

  const found = new Map(rows.map((r) => [r.id, r]));
  const missing = sourceIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 403,
      error: `Fuente(s) no encontrada(s) o de otro aliado: ${missing.join(", ")}`,
    };
  }

  const nonDoc = sourceIds.filter((id) => found.get(id)!.kind !== "doc");
  if (nonDoc.length > 0) {
    return {
      ok: false,
      status: 422,
      error: "El asistente solo soporta fuentes tipo documento (kind='doc') en v1; las fuentes tipo URL no están soportadas.",
    };
  }

  const gcs_objects = sourceIds
    .map((id) => found.get(id)!.gcs_object)
    .filter((g): g is string => !!g);

  return { ok: true, gcs_objects };
}
