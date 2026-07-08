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
