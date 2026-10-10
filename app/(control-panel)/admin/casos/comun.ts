// app/(control-panel)/admin/casos/comun.ts
// Lo que comparten la cola y la ficha de curaduría de casos (ADR-224).

import type { CasoEstado } from "@/lib/partners/casos-curaduria";

export const ESTADO_ETIQUETA: Record<CasoEstado, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  publicado: "Publicado",
  retirado: "Retirado",
};

export const TONO_ESTADO: Record<CasoEstado, "neutro" | "ok" | "aviso" | "riesgo"> = {
  borrador: "neutro",
  en_revision: "aviso",
  publicado: "ok",
  retirado: "neutro",
};

// Cada llave guarda SIEMPRE el sobre que devuelve su ruta (`{casos}` / `{caso, aliado, fuentes}`).
export const LLAVE_COLA = ["admin", "casos", "cola"] as const;
export const llaveCaso = (id: string) => ["admin", "casos", "detalle", id] as const;

/** Mensaje de una respuesta de error de nuestras rutas: `error` y, si viene, `details`. */
export function mensajeDeError(body: unknown, fallback: string): string {
  const b = (body ?? {}) as { error?: unknown; details?: unknown };
  const base = typeof b.error === "string" && b.error ? b.error : fallback;
  return typeof b.details === "string" && b.details && b.details !== base ? `${base}. ${b.details}` : base;
}

export function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
