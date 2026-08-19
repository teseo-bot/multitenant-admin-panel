// ADR-218 D-218.2 — la retícula HOCFLIT servida desde `hocflit_blocks`, que es la
// fuente única de la taxonomía Y de la geometría. Queda prohibido volver a declarar
// rótulos, descripciones u orden como constante por repo: lo único que sobrevive en
// código es el enum de validación (HOCFLIT_SYSTEMS en lib/kdb/schemas.ts).
//
// Aquí sólo vive lo que la tabla NO puede contener: el orden de lectura. `placement`
// dice si un grupo es techo, banda transversal, columna o piso, pero no dice en qué
// orden se pintan las cinco columnas entre sí — eso es el acrónimo del modelo, y por
// eso se deriva de la cadena 'HOCFLIT' en vez de listarse a mano.
//
// ⚠️ D-218.5: `placement` (piso/techo) es interpretación de micontexto, NO lenguaje del
// autor — en las 30 páginas del extracto «piso» y «techo» aparecen 0 veces. El campo se
// sirve tal cual está aplicado, y quien lo pinte para un cliente debe rotularlo. La
// pregunta abierta con el autor es si T es un estrato bajo las columnas o un par de I.

export const HOCFLIT_PLACEMENTS = ['techo', 'transversal', 'columna', 'piso'] as const;
export type HocflitPlacement = (typeof HOCFLIT_PLACEMENTS)[number];

/** Acrónimo del modelo. Fija el orden izquierda-derecha de las columnas. */
const ACRONIMO = 'HOCFLIT';

/** Fila cruda de `hocflit_blocks` (migrations-gcp/012_hocflit_blocks.sql). */
export interface HocflitBlockRow {
  code: string;
  group_code: string;
  group_name: string;
  placement: string;
  level: number;
  name: string;
  description: string | null;
  system_slug: string | null;
}

export interface HocflitBloque {
  code: string;
  /** Nivel de SOFISTICACIÓN 1..5 del modelo. NO es `altitude` (ver COMMENT de la 012). */
  level: number;
  nombre: string;
  descripcion: string | null;
}

export interface HocflitGrupo {
  code: string;
  nombre: string;
  placement: string;
  /** NULL en la Dirección Ejecutiva (E): no es un 8.º slug de sistema (D-218.6). */
  system_slug: string | null;
  bloques: HocflitBloque[];
}

function rangoPlacement(placement: string): number {
  const i = (HOCFLIT_PLACEMENTS as readonly string[]).indexOf(placement);
  // Un placement desconocido (la 012 lo impide con un CHECK, pero el CHECK puede
  // cambiar sin que este código se entere) se va al final en vez de romper el dibujo.
  return i === -1 ? HOCFLIT_PLACEMENTS.length : i;
}

function rangoAcronimo(groupCode: string): number {
  const i = ACRONIMO.indexOf(groupCode);
  return i === -1 ? ACRONIMO.length : i;
}

/**
 * Agrupa las filas de `hocflit_blocks` por grupo y las devuelve en orden de lectura:
 * techo → banda transversal → columnas (en orden del acrónimo) → piso. Dentro de cada
 * grupo, los bloques van por `level` ascendente.
 *
 * Tolera filas desordenadas y grupos incompletos a propósito: la tabla es un catálogo
 * curado que puede crecer, y un grupo nuevo debe aparecer en la retícula sin tocar código.
 */
export function construirReticula(rows: readonly HocflitBlockRow[]): HocflitGrupo[] {
  const porGrupo = new Map<string, HocflitGrupo>();

  for (const row of rows) {
    let grupo = porGrupo.get(row.group_code);
    if (!grupo) {
      grupo = {
        code: row.group_code,
        nombre: row.group_name,
        placement: row.placement,
        system_slug: row.system_slug,
        bloques: [],
      };
      porGrupo.set(row.group_code, grupo);
    }
    grupo.bloques.push({
      code: row.code,
      level: row.level,
      nombre: row.name,
      descripcion: row.description,
    });
  }

  const grupos = Array.from(porGrupo.values());
  for (const g of grupos) {
    g.bloques.sort((a, b) => a.level - b.level);
  }

  grupos.sort((a, b) => {
    const dp = rangoPlacement(a.placement) - rangoPlacement(b.placement);
    if (dp !== 0) return dp;
    const da = rangoAcronimo(a.code) - rangoAcronimo(b.code);
    if (da !== 0) return da;
    return a.code.localeCompare(b.code);
  });

  return grupos;
}

/**
 * Normaliza el conteo de conceptos por sistema devuelto por el Cold-Tier.
 *
 * D-218.7: la retícula se pinta con el volumen REAL, y un sistema vacío se ve vacío.
 * Por eso este mapa distingue 0 de ausencia: un sistema con 0 conceptos entra con 0
 * (está vacío, y eso es un dato), y sólo la imposibilidad de contar se representa
 * como `null` en el nivel de arriba. Confundir «no pude contar» con «hay cero» es
 * exactamente el modo en que el dibujo dejaría de medir y empezaría a afirmar.
 */
export function normalizarVolumen(
  rows: readonly { system_slug: string | null; total: number | string }[],
  sistemas: readonly string[]
): Record<string, number> {
  const volumen: Record<string, number> = {};
  for (const slug of sistemas) volumen[slug] = 0;

  for (const row of rows) {
    if (!row.system_slug) continue; // conceptos sin sistema: no cuelgan de ninguna columna
    const total = typeof row.total === 'string' ? Number.parseInt(row.total, 10) : row.total;
    if (!Number.isFinite(total)) continue;
    volumen[row.system_slug] = (volumen[row.system_slug] ?? 0) + total;
  }

  return volumen;
}
