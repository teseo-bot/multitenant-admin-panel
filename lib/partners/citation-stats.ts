// lib/partners/citation-stats.ts
// PA7-W3 (TRD §9; [INV-5.4]): lógica de agrupación de métricas de citas de aliados, extraída de
// app/(partners)/lab/metricas/page.tsx para poder testearla sin montar React.

import type { CitationStatRow } from "@/app/api/partners/me/citation-stats/route";

export interface ContractCitationSummary {
  contract_id: string;
  total: number;
  byDay: { day: string; citations: number }[];
}

/**
 * Agrupa las filas de `GET /api/partners/me/citation-stats` por contrato: total de citas en la
 * ventana + serie diaria ordenada de más reciente a más antigua. Array vacío -> [].
 */
export function groupStatsByContract(stats: CitationStatRow[]): ContractCitationSummary[] {
  const byContract = new Map<string, ContractCitationSummary>();

  for (const row of stats) {
    let entry = byContract.get(row.contract_id);
    if (!entry) {
      entry = { contract_id: row.contract_id, total: 0, byDay: [] };
      byContract.set(row.contract_id, entry);
    }
    entry.total += row.citations;
    entry.byDay.push({ day: row.day, citations: row.citations });
  }

  const result = Array.from(byContract.values());
  for (const entry of result) {
    entry.byDay.sort((a: { day: string }, b: { day: string }) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }
  return result;
}
