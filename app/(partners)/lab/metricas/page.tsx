// app/(partners)/lab/metricas/page.tsx
// KL6-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §5): vista de métricas
// del aliado de sesión.
// PA7-W3 (TRD §9; [INV-5.4]): wiring real contra GET /api/partners/me/citation-stats — por
// contrato, total de citas de los últimos 30 días + mini tabla de los últimos 7 días.

"use client";

import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import type { PartnerContractRow } from "@/app/api/partners/me/contracts/route";
import type { CitationStatRow } from "@/app/api/partners/me/citation-stats/route";
import { groupStatsByContract } from "@/lib/partners/citation-stats";

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

function useCitationStats() {
  return useQuery<{ stats: CitationStatRow[] }>({
    queryKey: ["partners", "me", "citation-stats"],
    queryFn: async () => {
      const res = await fetch("/api/partners/me/citation-stats");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al obtener métricas de citas");
      }
      return res.json();
    },
  });
}

export default function MetricasPage() {
  const { data: contractsData, isLoading: contractsLoading, error: contractsError } = useContracts();
  const { data: statsData, isLoading: statsLoading, error: statsError } = useCitationStats();

  const error = contractsError ?? statsError;
  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      </div>
    );
  }

  const isLoading = contractsLoading || statsLoading;
  const hasActiveContract =
    contractsData?.contracts?.some((c) => c.status === "active") ?? false;

  const contractsById = new Map(
    (contractsData?.contracts ?? []).map((c) => [c.id, c] as const)
  );
  const summaries = groupStatsByContract(statsData?.stats ?? []);
  const hasStats = summaries.length > 0;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Métricas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitorea el desempeño de tu conocimiento en la plataforma.
        </p>
      </div>

      {isLoading ? (
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
      ) : !hasStats ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aún no hay citas registradas</AlertTitle>
          <AlertDescription>
            Las métricas aparecen cuando los tenants consumen tu conocimiento certificado.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => {
            const contract = contractsById.get(summary.contract_id);
            const last7Days = summary.byDay.slice(0, 7);
            return (
              <div key={summary.contract_id} className="rounded-lg border p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {contract?.package_title ?? summary.contract_id}
                    </div>
                    {contract && (
                      <Badge variant="outline" className="mt-1">
                        {contract.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{summary.total}</div>
                    <div className="text-xs text-muted-foreground">citas (30 días)</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Día</TableHead>
                      <TableHead className="text-right">Citas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {last7Days.map((d) => (
                      <TableRow key={d.day}>
                        <TableCell>{d.day}</TableCell>
                        <TableCell className="text-right">{d.citations}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
