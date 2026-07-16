// lib/partners/catalog.ts
// PA7-W4 — Catálogo interno de paquetes de aliados.

export interface CatalogItem {
  package_id: string;
  package_slug: string;
  title: string;
  description: string;
  systems: string[];
  altitude_max: number;
  partner_id: string;
  partner_slug: string;
  legal_name: string;
  vertical: string;
  latest_version: number | null;
  active_contracts: number;
}

/**
 * Filtra el catálogo por consulta: busca en legal_name, title y vertical (case-insensitive).
 * @param items Elementos del catálogo
 * @param q Cadena de búsqueda
 * @returns Elementos que coinciden con la búsqueda, vacío si no hay matches
 */
export function filterCatalog(items: CatalogItem[], q: string): CatalogItem[] {
  if (!q.trim()) {
    return items;
  }

  const query = q.toLowerCase();
  return items.filter(
    (item) =>
      item.legal_name.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.vertical.toLowerCase().includes(query)
  );
}
