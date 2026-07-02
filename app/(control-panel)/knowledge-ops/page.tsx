// app/(control-panel)/knowledge-ops/page.tsx
// UXUI P1 — Dashboard de pipelines: layout raíz `/knowledge-ops`.
// "tabla de tenants con columnas: Tenant | Última V2 | Última V3 | Candidatos
// pendientes | Drafts en staging | Proposals HITL pendientes (badge rojo si >0) |
// Score eval último (con flecha ▲▼ vs anterior). Fila clickeable → detalle."
//
// La lista de tenants reusa GET /api/tenant (ya existente, ver app/api/tenant/route.ts,
// guardado con requirePlatformAdmin) igual que app/(control-panel)/tenants/page.tsx.
// Las métricas KDB por tenant vienen de GET /api/kdb/[tenantId]/status (K7-W1); no hay
// endpoint agregado multi-tenant, así que se hace un query por tenant (panel interno,
// volumen bajo de tenants).

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatTimestamp } from "@/lib/knowledge-ops/format";
import { useErrorToast, type KdbStatus } from "@/lib/knowledge-ops/hooks";
import { ErrorState } from "@/components/knowledge-ops/ErrorState";
import type { MergeProposal } from "@/lib/kdb/schemas";

interface EvalRun {
  id: string;
  run_at: string;
  score: number;
  model_version: string | null;
}

interface TenantRow {
  id: string;
  name: string;
  domain?: string;
  status: string;
  created_at: string;
}

function useTenants() {
  return useQuery<TenantRow[]>({
    queryKey: ["tenants", "list-for-knowledge-ops"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Error al listar tenants");
      }
      return res.json();
    },
  });
}

function useTenantKdbStatus(tenantId: string) {
  return useQuery<KdbStatus>({
    queryKey: ["kdb", tenantId, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/kdb/${tenantId}/status`);
      if (!res.ok) throw new Error(`Error al consultar status de ${tenantId}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

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

function useEvalTrend(tenantId: string) {
  return useQuery<{ latest: number | null; delta: number | null }>({
    queryKey: ["kdb", tenantId, "evals", "trend"],
    queryFn: async () => {
      const res = await fetch(`/api/kdb/${tenantId}/evals`);
      if (!res.ok) throw new Error(`Error al consultar evals de ${tenantId}`);
      const data: { runs: EvalRun[] } = await res.json();
      const runs = data.runs ?? [];
      const latest = runs[0]?.score ?? null;
      const previous = runs[1]?.score ?? null;
      const delta = latest !== null && previous !== null ? latest - previous : null;
      return { latest, delta };
    },
    refetchInterval: 30_000,
  });
}

function TenantKdbRow({ tenant }: { tenant: TenantRow }) {
  const { data: status, isLoading } = useTenantKdbStatus(tenant.id);
  const { data: pendingCount, isLoading: isLoadingPending } = usePendingHitlCount(tenant.id);
  const { data: evalTrend, isLoading: isLoadingEval } = useEvalTrend(tenant.id);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => {
        window.location.href = `/knowledge-ops/${tenant.id}`;
      }}
    >
      <TableCell className="font-medium">
        <Link href={`/knowledge-ops/${tenant.id}`} className="hover:underline">
          {tenant.name}
        </Link>
      </TableCell>
      <TableCell>
        {isLoading ? <Skeleton className="h-4 w-24" /> : formatTimestamp(status?.pipelines.v2_last_run ?? null)}
      </TableCell>
      <TableCell>
        {isLoading ? <Skeleton className="h-4 w-24" /> : formatTimestamp(status?.pipelines.v3_last_run ?? null)}
      </TableCell>
      <TableCell>
        {isLoading ? <Skeleton className="h-4 w-8" /> : status?.pipelines.candidates_pending ?? 0}
      </TableCell>
      <TableCell>
        {isLoading ? <Skeleton className="h-4 w-8" /> : status?.pipelines.drafts_staged ?? 0}
      </TableCell>
      <TableCell>
        {isLoadingPending ? (
          <Skeleton className="h-4 w-8" />
        ) : pendingCount && pendingCount > 0 ? (
          <Badge variant="destructive" aria-label={`${pendingCount} proposals pendientes de revisión`}>
            {pendingCount}
          </Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell>
        {isLoadingEval ? (
          <Skeleton className="h-4 w-16" />
        ) : evalTrend?.latest !== null && evalTrend?.latest !== undefined ? (
          <span className="inline-flex items-center gap-1">
            {evalTrend.latest}
            {evalTrend.delta === null ? (
              <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            ) : evalTrend.delta > 0 ? (
              <ArrowUp className="h-3 w-3 text-green-600" aria-label="Mejoró vs corrida anterior" />
            ) : evalTrend.delta < 0 ? (
              <ArrowDown className="h-3 w-3 text-red-600" aria-label="Empeoró vs corrida anterior" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Sin evals</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function KnowledgeOpsDashboardPage() {
  const { data: tenants, isLoading, error, refetch } = useTenants();
  useErrorToast(error, refetch);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Knowledge Ops</h2>
          <p className="text-muted-foreground mt-1">
            Estado del cerebro virtual (OKF) por tenant.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Última V2</TableHead>
                <TableHead>Última V3</TableHead>
                <TableHead>Candidatos pendientes</TableHead>
                <TableHead>Drafts en staging</TableHead>
                <TableHead>Proposals HITL pendientes</TableHead>
                <TableHead>Score eval último</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tenants ?? []).map((tenant) => (
                <TenantKdbRow key={tenant.id} tenant={tenant} />
              ))}
              {(tenants ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No hay tenants.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
