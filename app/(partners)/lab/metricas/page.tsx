// app/(partners)/lab/metricas/page.tsx
// KL6-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §5): vista de métricas
// del aliado de sesión — estado informativo sin data-fetching de tablas inexistentes (PA7-W3).

"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingUp } from "lucide-react";
import type { PartnerContractRow } from "@/app/api/partners/me/contracts/route";

function useContracts() {
  return useQuery<{ contracts: PartnerContractRow[] }>({
    queryKey: ["partners", "me", "contracts"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/contracts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al obtener contratos");
      }
      return res.json();
    },
  });
}

export default function MetricasPage() {
  const { data: contractsData, isLoading: contractsLoading, error } = useContracts();

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  const hasActiveContract =
    contractsData?.contracts?.some((c) => c.status === "active") ?? false;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Métricas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitorea el desempeño de tu conocimiento en la plataforma.
        </p>
      </div>

      {contractsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !hasActiveContract ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Métricas no disponibles</AlertTitle>
          <AlertDescription>
            Se activa con tu primer contrato activo. Una vez que clientes licencien tu paquete,
            verás aquí las métricas de uso.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>Tus contratos ya generan citas</AlertTitle>
            <AlertDescription>
              La agregación diaria de métricas se activa próximamente (PA7-W3: integración de
              partner_citation_stats pendiente).
            </AlertDescription>
          </Alert>

          {/* PA7-W3: partner_citation_stats — wiring pendiente */}
          {/*
             Una vez que PA7-W3 esté integrada, la consulta será:
             - SELECT COUNT(*) as citas_mes, contract_id FROM partner_citation_stats
               WHERE partner_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
               GROUP BY contract_id
             - Renderizar tabla con contrato, citas/mes, y sparkline de tendencia (opcional)
             - Mostrar también "Presencia digital" como métrica agregada si cumple ciertos criterios
          */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-6">
              <div className="text-sm font-medium text-muted-foreground">Citas este mes</div>
              <div className="mt-2 text-3xl font-bold">—</div>
              <div className="text-xs text-muted-foreground mt-2">
                Agregación diaria en progreso
              </div>
            </div>
            <div className="rounded-lg border p-6">
              <div className="text-sm font-medium text-muted-foreground">
                Presencia digital
              </div>
              <div className="mt-2 text-3xl font-bold">—</div>
              <div className="text-xs text-muted-foreground mt-2">
                Se muestra cuando contrato es activo
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
