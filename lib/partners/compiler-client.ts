// lib/partners/compiler-client.ts
// KL2-W1/W2: cliente mínimo hacia las rutas M2M `/internal/*` de context-kdb-compiler.
//
// DESVIACIÓN reportada (no había patrón previo que espejar): `grep -rn "M2M_API_KEY|COMPILER"
// lib/ app/api/` no encontró ninguna ruta del panel que llame HOY a las rutas `/internal/*`
// del compiler. Sí existen dos pistas parciales, ninguna aplicable tal cual:
//   - `M2M_API_KEY` YA es el nombre usado por el panel para el secreto compartido de rutas M2M
//     entrantes (app/api/internal/user-modules/route.ts) — se reusa aquí para las llamadas
//     salientes, es el mismo secreto bidireccional que valida x-api-key en el compiler
//     (context-kdb-compiler/src/server.ts, todas las rutas /internal/*).
//   - `COMPILER_INTERNAL_URL` (app/api/leads/[id]/handoff/route.ts) apunta por defecto a
//     `http://localhost:8000` y llama a `/api/internal/graph/interrupt` — es OTRO servicio
//     (el orquestador LangGraph, no context-kdb-compiler, cuyo puerto por defecto es 8080 y
//     cuyas rutas son `/internal/*` sin el prefijo `/api`). Reusar ese nombre habría sido
//     incorrecto. Se introduce `KDB_COMPILER_URL` (default `http://localhost:8080`, el puerto
//     real de context-kdb-compiler) como variable nueva y explícita.
import { logger } from "@/lib/logger";

const KDB_COMPILER_URL = process.env.KDB_COMPILER_URL || "http://localhost:8080";

export class CompilerCallError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "CompilerCallError";
    this.status = status;
    this.body = body;
  }
}

async function callCompiler<T>(path: string, payload: unknown): Promise<T> {
  const apiKey = process.env.M2M_API_KEY;
  if (!apiKey) {
    throw new Error("M2M_API_KEY no está configurado en el panel.");
  }

  const res = await fetch(`${KDB_COMPILER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error("lib.partners.compiler_client.error", { path, status: res.status, data });
    throw new CompilerCallError(
      (data as { error?: string })?.error || `Error ${res.status} al llamar a ${path}`,
      res.status,
      data
    );
  }

  return data as T;
}

export interface PartnerSourceUploadResult {
  sha256: string;
  gcs_object: string;
}

/** Proxy a `POST /internal/partner-source-upload` (KL2-W1, context-kdb-compiler). */
export async function uploadPartnerSourceToCompiler(input: {
  partner_id: string;
  filename: string;
  content_base64: string;
}): Promise<PartnerSourceUploadResult> {
  return callCompiler<PartnerSourceUploadResult>("/internal/partner-source-upload", input);
}

export interface PartnerIngestDraft {
  path: string;
  title: string;
  system: string;
  altitude: number;
  pii: "clean" | "redacted";
}

export interface PartnerIngestResult {
  drafts: PartnerIngestDraft[];
}

/** Proxy a `POST /internal/partner-ingest` (PA2-W3, extendida en KL2-W2 con
 * `source_gcs_object`). */
export async function ingestPartnerSourceViaCompiler(input: {
  partner_id: string;
  package_slug: string;
  source_gcs_object: string;
}): Promise<PartnerIngestResult> {
  return callCompiler<PartnerIngestResult>("/internal/partner-ingest", input);
}

// KL3-W1: plomería de drafts para el editor guiado (P-KL3). Los tres proxies siguientes
// llaman a las rutas M2M que agrega context-kdb-compiler en la misma WU
// (src/partners/partner-drafts-list.ts + src/partners/partner-draft-update.ts).

export interface PartnerDraftListItem {
  path: string;
  title: string;
  type: string;
  system: string;
  altitude: number;
  pii: string;
  confidence: string;
  updated?: string;
}

export interface PartnerDraftsListResult {
  drafts: PartnerDraftListItem[];
}

/** Proxy a `POST /internal/partner-drafts-list` (KL3-W1). Lista drafts pendientes bajo
 * `_staging/` (ya excluye los publicados — filtro as-built PA2-W4, resuelto en el compiler). */
export async function listPartnerDraftsViaCompiler(input: {
  partner_id: string;
  package_slug?: string;
}): Promise<PartnerDraftsListResult> {
  return callCompiler<PartnerDraftsListResult>("/internal/partner-drafts-list", input);
}

export interface PartnerDraftGetResult {
  markdown: string;
}

/** Proxy a `POST /internal/partner-draft-get` (KL3-W1). 422 si `draft_path` no está bajo
 * `_staging/` (mismo guard anti-traversal que `partner-draft-update`). */
export async function getPartnerDraftViaCompiler(input: {
  partner_id: string;
  draft_path: string;
}): Promise<PartnerDraftGetResult> {
  return callCompiler<PartnerDraftGetResult>("/internal/partner-draft-get", input);
}

export interface PartnerDraftUpdateResult {
  path: string;
  updated: boolean;
}

/** Proxy a `POST /internal/partner-draft-update` (PA2-W3, ya existente en el compiler). */
export async function updatePartnerDraftViaCompiler(input: {
  partner_id: string;
  draft_path: string;
  markdown: string;
}): Promise<PartnerDraftUpdateResult> {
  return callCompiler<PartnerDraftUpdateResult>("/internal/partner-draft-update", input);
}
