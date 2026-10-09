// lib/partners/casos-curaduria.ts
// ADR-224 paso 3 (D-224.2): la curaduría de micontexto sobre los casos de éxito que escriben los
// aliados en aliados.micontexto.com. Ningún caso se publica sin pasar por aquí.
//
// Los casos viven en el Cold-Tier (`casos_exito`, context-kdb-compiler/migrations/016). Este panel
// no los toca directo: llama a las rutas `/internal/curaduria-caso*` del compiler con una clave
// PROPIA, `CURADURIA_M2M_API_KEY` (secreto `COMPILER_CURADURIA_API_KEY`). La del portal de aliados
// no publica.
//
// Lo que se prueba en casos-curaduria.test.ts:
//   · sólo un Platform Admin entra (`requirePlatformAdmin`);
//   · `curador_uid` sale SIEMPRE de la sesión, nunca del body: es el `revisado_por` del caso;
//   · devolver exige un motivo legible (≥ 10), porque es lo que el aliado leerá para corregir.

import { z } from "zod";
import type { GuardResult } from "@/lib/auth/guards";
import { CompilerCallError } from "@/lib/partners/compiler-client";

export const MOTIVO_DEVOLUCION_MIN = 10;

export type CasoEstado = "borrador" | "en_revision" | "publicado" | "retirado";

export interface HallazgoCaso {
  campo: string;
  regla: string;
  mensaje_es: string;
}

export interface CasoEnCola {
  id: string;
  partner_id: string;
  slug: string;
  titulo: string | null;
  sector: string | null;
  tamano: string | null;
  version_publicada: number | null;
  motivo_devolucion: string | null;
  updated_at: string;
}

export interface VersionCaso {
  version: number;
  content_sha256: string;
  publicado_por: string;
  publicado_at: string;
}

export interface CasoParaCuraduria extends CasoEnCola {
  estado: CasoEstado;
  frontmatter: Record<string, unknown>;
  cuerpo_md: string;
  nota_consultor_md: string;
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string;
  hallazgos: HallazgoCaso[];
  versiones: VersionCaso[];
}

export interface AliadoResumen {
  id: string;
  slug: string;
  legal_name: string;
}

/** Una fuente de evidencia del caso, resuelta contra la biblioteca del aliado si se puede. */
export interface FuenteEvidencia {
  ref: string;
  titulo: string | null;
  url: string | null;
  gcs_object: string | null;
}

// ─────────────────────────── cliente del compiler ───────────────────────────

async function callCuraduria<T>(path: string, payload: unknown): Promise<T> {
  const apiKey = process.env.CURADURIA_M2M_API_KEY;
  if (!apiKey) {
    throw new Error("CURADURIA_M2M_API_KEY no está configurado en el panel.");
  }
  const base = process.env.KDB_COMPILER_URL || "http://localhost:8080";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { error?: string; details?: unknown };
    const details = typeof body.details === "string" ? body.details : body.details ? JSON.stringify(body.details) : "";
    throw new CompilerCallError(
      [body.error || `Error ${res.status} al llamar a ${path}`, details].filter(Boolean).join(": "),
      res.status,
      data
    );
  }
  return data as T;
}

export const compilerCuraduria = {
  listar: () => callCuraduria<{ casos: CasoEnCola[] }>("/internal/curaduria-casos-list", {}),
  obtener: (casoId: string) => callCuraduria<{ caso: CasoParaCuraduria }>("/internal/curaduria-caso-get", { caso_id: casoId }),
  devolver: (input: { caso_id: string; curador_uid: string; motivo: string }) =>
    callCuraduria<{ caso: CasoParaCuraduria }>("/internal/curaduria-caso-devolver", input),
  publicar: (input: { caso_id: string; curador_uid: string }) =>
    callCuraduria<{ caso: CasoParaCuraduria }>("/internal/curaduria-caso-publicar", input),
};

// ─────────────────────────── manejadores ───────────────────────────

export interface Respuesta {
  status: number;
  body: unknown;
}

export interface CuraduriaDeps {
  guard: () => Promise<GuardResult>;
  compiler: typeof compilerCuraduria;
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  logError: (event: string, data: Record<string, unknown>) => void;
}

export const DevolverBodySchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(MOTIVO_DEVOLUCION_MIN, `Explica el motivo en al menos ${MOTIVO_DEVOLUCION_MIN} caracteres: es lo que el aliado leerá para corregir.`)
    .max(2000, "El motivo admite 2000 caracteres."),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 404, 409 y 422 son respuestas del dominio y viajan con su cuerpo; el resto, 502 con la causa. */
function desdeCompiler(err: unknown, deps: CuraduriaDeps, evento: string): Respuesta {
  if (err instanceof CompilerCallError) {
    const cuerpo = (err.body ?? {}) as { error?: string; hallazgos?: unknown; estado?: unknown };
    if (err.status === 404 || err.status === 409 || err.status === 422) {
      return {
        status: err.status,
        body: {
          error: cuerpo.error ?? err.message,
          ...(cuerpo.hallazgos ? { hallazgos: cuerpo.hallazgos } : {}),
          ...(cuerpo.estado ? { estado: cuerpo.estado } : {}),
        },
      };
    }
    deps.logError(evento, { status: err.status, error: err.message });
    return { status: 502, body: { error: "El servicio de casos no respondió bien", details: err.message } };
  }
  deps.logError(evento, { error: String(err) });
  return { status: 500, body: { error: "Error interno del servidor", details: String(err) } };
}

async function aliados(deps: CuraduriaDeps, ids: string[]): Promise<Map<string, AliadoResumen>> {
  if (ids.length === 0) return new Map();
  const { rows } = await deps.query(`SELECT id, slug, legal_name FROM partners WHERE id = ANY($1::uuid[])`, [ids]);
  return new Map(rows.map((r: AliadoResumen) => [r.id, r]));
}

/**
 * Las fuentes de evidencia del encabezado, con nombre: `doc:sha256:…` se busca en la biblioteca
 * del aliado (`partner_sources` de control); `url:…` se vuelve enlace.
 */
async function fuentesDeEvidencia(deps: CuraduriaDeps, partnerId: string, frontmatter: Record<string, unknown>): Promise<FuenteEvidencia[]> {
  const evidencia = (frontmatter.evidencia ?? {}) as { fuentes?: unknown };
  const refs = Array.isArray(evidencia.fuentes) ? evidencia.fuentes.filter((f): f is string => typeof f === "string") : [];
  if (refs.length === 0) return [];
  const { rows } = await deps.query(
    `SELECT source_ref, title, gcs_object FROM partner_sources WHERE partner_id = $1 AND source_ref = ANY($2::text[])`,
    [partnerId, refs]
  );
  const porRef = new Map(rows.map((r: { source_ref: string; title: string; gcs_object: string | null }) => [r.source_ref, r]));
  return refs.map((ref) => {
    const fila = porRef.get(ref);
    return {
      ref,
      titulo: fila?.title ?? null,
      url: ref.startsWith("url:") ? ref.slice(4) : null,
      gcs_object: fila?.gcs_object ?? null,
    };
  });
}

export async function colaDeCuraduria(deps: CuraduriaDeps): Promise<Respuesta> {
  const guard = await deps.guard();
  if (!guard.ok) return { status: guard.status, body: { error: guard.error } };
  try {
    const { casos } = await deps.compiler.listar();
    const porId = await aliados(deps, Array.from(new Set(casos.map((c) => c.partner_id))));
    return { status: 200, body: { casos: casos.map((c) => ({ ...c, aliado: porId.get(c.partner_id) ?? null })) } };
  } catch (err) {
    return desdeCompiler(err, deps, "api.admin.casos.list.error");
  }
}

export async function casoDeCuraduria(deps: CuraduriaDeps, casoId: string): Promise<Respuesta> {
  const guard = await deps.guard();
  if (!guard.ok) return { status: guard.status, body: { error: guard.error } };
  if (!UUID_RE.test(casoId)) return { status: 404, body: { error: "Caso no encontrado" } };
  try {
    const { caso } = await deps.compiler.obtener(casoId);
    const porId = await aliados(deps, [caso.partner_id]);
    const fuentes = await fuentesDeEvidencia(deps, caso.partner_id, caso.frontmatter);
    return { status: 200, body: { caso, aliado: porId.get(caso.partner_id) ?? null, fuentes } };
  } catch (err) {
    return desdeCompiler(err, deps, "api.admin.casos.get.error");
  }
}

export async function devolverCaso(deps: CuraduriaDeps, casoId: string, body: unknown): Promise<Respuesta> {
  const guard = await deps.guard();
  if (!guard.ok) return { status: guard.status, body: { error: guard.error } };
  if (!UUID_RE.test(casoId)) return { status: 404, body: { error: "Caso no encontrado" } };
  const parsed = DevolverBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 422, body: { error: parsed.error.issues[0]?.message ?? "Motivo inválido" } };
  }
  try {
    const { caso } = await deps.compiler.devolver({ caso_id: casoId, curador_uid: guard.user.id, motivo: parsed.data.motivo });
    return { status: 200, body: { caso } };
  } catch (err) {
    return desdeCompiler(err, deps, "api.admin.casos.devolver.error");
  }
}

export async function publicarCaso(deps: CuraduriaDeps, casoId: string): Promise<Respuesta> {
  const guard = await deps.guard();
  if (!guard.ok) return { status: guard.status, body: { error: guard.error } };
  if (!UUID_RE.test(casoId)) return { status: 404, body: { error: "Caso no encontrado" } };
  try {
    const { caso } = await deps.compiler.publicar({ caso_id: casoId, curador_uid: guard.user.id });
    return { status: 200, body: { caso } };
  } catch (err) {
    return desdeCompiler(err, deps, "api.admin.casos.publicar.error");
  }
}
