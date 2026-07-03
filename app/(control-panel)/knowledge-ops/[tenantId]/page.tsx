// app/(control-panel)/knowledge-ops/[tenantId]/page.tsx
// UXUI P1 — Detalle (`/knowledge-ops/[tenantId]`): "4 cards superiores (Candidatos
// pendientes, Drafts staged, HITL pendientes, Score eval) + tabla de últimas 20
// corridas de pipeline (tipo, inicio, fin, estado, conteos, error si hay)."
//
// GET /api/kdb/[tenantId]/status (TRD §9) NO devuelve una lista de corridas —
// solo agregados (candidates_pending, drafts_staged, v2_last_run, v3_last_run,
// eval_last). No existe endpoint de "últimas 20 corridas" en K7-W1. Por instrucción
// explícita de la WU se muestra el estado vacío documentado. TODO K8-W2: exponer
// GET /api/kdb/[tenantId]/runs (o extender /status) con las últimas 20 corridas de
// pipeline (tipo, inicio, fin, estado, conteos, error) para completar esta tabla.

"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useKdbStatus, useErrorToast } from "@/lib/knowledge-ops/hooks";
import { ErrorState } from "@/components/knowledge-ops/ErrorState";
import { formatTimestamp } from "@/lib/knowledge-ops/format";
import type { MergeProposal } from "@/lib/kdb/schemas";

function usePendingHitlCount(tenantId: string) {
  return useQuery<number>({
    queryKey: ["kdb", tenantId, "proposals", "pending_hitl", "count"],
    queryFn: async () => {
      const res = await fetch(`/api/kdb/${tenantId}/proposals?status=pending_hitl`);
      if (!res.ok) throw new Error(`Error al consultar proposals de ${tenantId}`);
      const proposals: MergeProposal[] = await res.json();
      return proposals.length;
    },
    refetchInterval: 30_000,
  });
}

export default function KnowledgeOpsTenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const { data: status, isLoading, error, refetch } = useKdbStatus(tenantId);
  useErrorToast(error, refetch);
  const { data: pendingHitl, isLoading: isLoadingPending } = usePendingHitlCount(tenantId);

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Candidatos pendientes</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-8 w-12" /> : status?.pipelines.candidates_pending ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts en staging</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-8 w-12" /> : status?.pipelines.drafts_staged ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>HITL pendientes</CardDescription>
            <CardTitle className="text-3xl">
              {isLoadingPending ? <Skeleton className="h-8 w-12" /> : pendingHitl ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Score eval</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : status?.eval_last ? (
                status.eval_last.score
              ) : (
                <span className="text-base font-normal text-muted-foreground">Sin evals</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas 20 corridas de pipeline</CardTitle>
          <CardDescription>
            Tipo, inicio, fin, estado, conteos y error de cada corrida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Conteos</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* TODO K8-W2: reemplazar por datos reales de GET /api/kdb/[tenantId]/runs
                    (endpoint aún no existe). Estado vacío documentado por UXUI P1:
                    "Sin corridas aún — el bundle fue creado el {fecha}" con link a runbook. */}
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <span>
                        Sin corridas aún — el bundle fue creado el{" "}
                        {formatTimestamp(status?.pipelines.v2_last_run ?? null, "fecha desconocida")}
                      </span>
                      <a
                        href="/knowledge-ops"
                        className="text-primary underline underline-offset-2 text-xs"
                      >
                        Ver runbook
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
