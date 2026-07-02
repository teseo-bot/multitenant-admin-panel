// components/knowledge-ops/PipelineStatusBadge.tsx
// UXUI-OKF-Knowledge-Ops.md — PipelineStatusBadge { status } — ok/partial/error.
// §0 Navegación: "badge de estado del último V3 (ok verde / partial ámbar / error rojo)".

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PipelineStatus = "ok" | "partial" | "error";

export interface PipelineStatusBadgeProps {
  status: PipelineStatus;
  className?: string;
}

const STATUS_LABEL: Record<PipelineStatus, string> = {
  ok: "OK",
  partial: "Parcial",
  error: "Error",
};

const STATUS_STYLES: Record<PipelineStatus, string> = {
  ok: "bg-green-100 text-green-800 border-transparent dark:bg-green-950 dark:text-green-300",
  partial: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  error: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
};

export function PipelineStatusBadge({ status, className }: PipelineStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_STYLES[status], className)}
      aria-label={`Estado del pipeline: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}
