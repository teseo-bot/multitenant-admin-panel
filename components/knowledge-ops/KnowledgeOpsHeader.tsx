// components/knowledge-ops/KnowledgeOpsHeader.tsx
// UXUI-OKF-Knowledge-Ops.md §0: "Todas las pantallas comparten un header con: nombre
// del tenant, badge de estado del último V3 (ok verde / partial ámbar / error rojo), y
// timestamp de última consolidación."
//
// GET /api/kdb/[tenantId]/status (TRD §9) no expone un campo explícito de "estado V3"
// (ok/partial/error) — solo `v3_last_run` (timestamp) y `eval_last`. Se deriva:
//   - sin v3_last_run           → "partial" (aún no ha corrido V3)
//   - v3_last_run + eval_last   → "ok"
//   - v3_last_run sin eval_last → "partial" (corrió consolidación pero sin eval registrada)
// El caso "error" no es derivable de este endpoint (requeriría exponer el estado real
// de la última corrida V3, p.ej. desde night-worker/state). TODO K8-W2: exponer un
// campo `v3_status` explícito en /api/kdb/[tenantId]/status para eliminar esta heurística.

"use client";

import { PipelineStatusBadge, type PipelineStatus } from "./PipelineStatusBadge";
import { formatTimestamp } from "@/lib/knowledge-ops/format";
import type { KdbStatus } from "@/lib/knowledge-ops/hooks";

export interface KnowledgeOpsHeaderProps {
  tenantName: string;
  status: KdbStatus | undefined;
  isLoading: boolean;
}

function deriveV3Status(status: KdbStatus | undefined): PipelineStatus {
  if (!status?.pipelines.v3_last_run) return "partial";
  if (status.eval_last) return "ok";
  return "partial";
}

export function KnowledgeOpsHeader({ tenantName, status, isLoading }: KnowledgeOpsHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-8 py-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{tenantName}</h1>
        {!isLoading && status && <PipelineStatusBadge status={deriveV3Status(status)} />}
      </div>
      <div className="text-sm text-muted-foreground">
        Última consolidación:{" "}
        {isLoading ? "…" : formatTimestamp(status?.pipelines.v3_last_run ?? null, "sin corridas aún")}
      </div>
    </div>
  );
}
