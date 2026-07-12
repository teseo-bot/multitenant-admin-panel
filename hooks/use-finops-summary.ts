import { useQuery } from '@tanstack/react-query';
// `import type` (no de valor): evita que el bundle del cliente arrastre
// lib/finops-service → lib/db (pg), que rompía el build. Los datos se piden
// a la API server-side /api/finops/summary.
import type { FinOpsSummary } from '@/lib/finops-service';

async function fetchFinOpsSummary(): Promise<FinOpsSummary[]> {
  const res = await fetch('/api/finops/summary');
  if (!res.ok) throw new Error('No se pudo cargar el resumen FinOps');
  return res.json();
}

export function useFinOpsSummary() {
  return useQuery<FinOpsSummary[], Error>({
    queryKey: ['finops_summary'],
    queryFn: fetchFinOpsSummary,
    // Short-polling cada 60 segundos para mantener la vista fresca
    // sin saturar la cuota de peticiones HTTP en serverless.
    refetchInterval: 60000,
  });
}
