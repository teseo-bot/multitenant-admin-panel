// lib/partners/sources.ts
// KL2-W1: validación y esquemas para la biblioteca de fuentes del Lab (DISEÑO-Knowledge-Lab.md
// §3.2/§3.3). Mismo patrón que lib/partners/packages.ts.

import { z } from "zod";

/**
 * Body de registro de una fuente tipo URL (`POST /api/partners/me/sources` sin multipart).
 * `source_ref` se deriva en la ruta como `'url:' + url` (SourceRefSchema de @teseo/contracts:
 * `url:https://…`), no forma parte del body.
 */
export const RegisterUrlSourceSchema = z.object({
  kind: z.literal("url"),
  title: z.string().min(1).max(200),
  url: z
    .string()
    .url({ message: "URL inválida" })
    .refine((u) => /^https?:\/\//i.test(u), {
      message: "La URL debe ser http(s)",
    }),
});

export type RegisterUrlSourceBody = z.infer<typeof RegisterUrlSourceSchema>;

/** Metadata mínima que acompaña al archivo en la subida multipart (`kind:'doc'`). */
export const RegisterDocSourceMetaSchema = z.object({
  title: z.string().min(1).max(200),
});

export type PartnerSourceKind = "doc" | "url";
export type PartnerSourceIngestStatus =
  | "registered"
  | "distilling"
  | "distilled"
  | "failed";

export interface PartnerSourceRow {
  id: string;
  partner_id: string;
  kind: PartnerSourceKind;
  title: string;
  source_ref: string;
  gcs_object: string | null;
  ingest_status: PartnerSourceIngestStatus;
  created_by: string;
  created_at: string;
}

/** Body de `POST /api/partners/me/sources/{id}/distill`. */
export const DistillSourceBodySchema = z.object({
  package_id: z.string().uuid({ message: "package_id debe ser UUID" }),
});

export type DistillSourceBody = z.infer<typeof DistillSourceBodySchema>;
