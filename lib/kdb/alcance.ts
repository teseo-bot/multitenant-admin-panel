// ADR-220 D-220.5 — el eje de ALCANCE del conocimiento, servido por tenant.
//
// El alcance es la pregunta «¿quién podrá citar este documento?» que la superficie de
// carga hace después de la retícula. En tenant1 ese eje es la MARCA (ADR-215); en el
// tenant del entrevistador será el PROYECTO (ADR-220 fase 2). Son ejes distintos con
// defaults OPUESTOS, y por eso el panel no puede llevarlos escritos: hasta hoy
// `tenant-admin-panel/lib/knowledge/schemas.ts` declaraba `['fleetco','cargalo']` como
// literal, así que cualquier otro tenant veía dos marcas que no son suyas y la ingesta
// rechazaba con 400 cualquier valor propio.
//
// Aquí se construye el eje a partir de `tenant_brands`, que es el registro que ya usa el
// orquestador para resolver marca por canal. No hay tabla nueva ni migración: esta es la
// mitad reversible de la decisión (D-220.8).

/** Fila de `tenant_brands` (migrations-gcp/013_tenant_brands.sql). */
export interface TenantBrandRow {
  slug: string;
  display_name: string;
}

export interface OpcionAlcance {
  slug: string;
  label: string;
  descripcion: string;
}

export interface EjeAlcance {
  /** Qué eje es. El panel lo usa para decidir por qué campo viaja al ingerir. */
  clave: 'marca';
  /** Rótulo del paso en la superficie de carga. */
  rotulo: string;
  /**
   * Qué significa NO elegir ninguna opción, y si es el valor inicial.
   *
   * En marca, el conjunto vacío es «compartido» y ES el default ([INV-215.5]): la mayoría
   * del corpus sirve a todas las marcas y etiquetarlo por producto anularía el
   * retargeting. En proyecto será lo contrario (D-220.2) — por eso el default viaja como
   * dato y no como costumbre del panel.
   */
  compartido: {
    label: string;
    descripcion: string;
    es_default: boolean;
  };
  opciones: OpcionAlcance[];
}

/**
 * Construye el eje de marca a partir de las marcas ACTIVAS del tenant.
 *
 * Devuelve `null` con menos de dos marcas, y no es un caso defensivo: con una sola marca,
 * «compartido» y «sólo esa marca» alcanzan exactamente al mismo agente. Dibujar ahí un
 * selector ofrece una decisión que no existe, y quien la tome creerá haber acotado algo.
 *
 * Un tenant sin marcas —el del entrevistador, hoy— también devuelve `null`: no tiene ejes
 * todavía, y el paso no se dibuja. Quien consuma esto debe distinguir ese `null` de «no se
 * pudo leer el catálogo», que es un estado distinto y se sirve aparte.
 */
export function construirEjeMarca(marcas: readonly TenantBrandRow[]): EjeAlcance | null {
  if (marcas.length < 2) return null;

  return {
    clave: 'marca',
    rotulo: 'Marca',
    compartido: {
      label: 'Compartido',
      // Copia heredada de `BRAND_CHOICES` del panel del tenant, que es de donde viene.
      descripcion: 'Todas las marcas lo usan. Mercado, sector, dolores del cliente, objeciones.',
      es_default: true,
    },
    opciones: marcas.map((m) => ({
      slug: m.slug,
      label: `Solo ${m.display_name}`,
      descripcion: `Sólo el agente de ${m.display_name} podrá citarlo.`,
    })),
  };
}
