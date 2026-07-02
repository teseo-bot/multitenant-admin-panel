// lib/knowledge-ops/concept-content.ts
// K7-W2: hook para GET /api/kdb/[tenantId]/concepts/content?path= — usado en P2 para
// obtener el "archivo vivo" a comparar en el diff cuando action=update, y en P3 para
// el visor de concepto.

import { useQuery } from "@tanstack/react-query";

export interface ConceptContent {
  frontmatter: Record<string, unknown>;
  body: string;
  log_entries: string[];
}

export function useConceptContent(tenantId: string, path: string | null) {
  return useQuery<ConceptContent | null>({
    queryKey: ["kdb", tenantId, "concepts", "content", path],
    queryFn: async () => {
      if (!path) return null;
      const res = await fetch(
        `/api/kdb/${tenantId}/concepts/content?path=${encodeURIComponent(path)}`
      );
      if (res.status === 404) return null; // create: no hay archivo vivo aún
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al obtener el concepto vivo");
      }
      return res.json();
    },
    enabled: !!tenantId && !!path,
  });
}
