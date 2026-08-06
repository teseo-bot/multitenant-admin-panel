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
  ok: "bg-chart-2/10 text-chart-2 border-transparent dark:bg-chart-2 dark:text-chart-2",
  partial: "bg-primary/10 text-primary border-transparent dark:bg-primary dark:text-primary",
  error: "bg-destructive/10 text-destructive border-transparent dark:bg-destructive dark:text-destructive",
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
