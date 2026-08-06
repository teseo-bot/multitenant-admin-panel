// components/knowledge-ops/ConfidenceBadge.tsx
// UXUI-OKF-Knowledge-Ops.md — ConfidenceBadge { confidence } — draft/reviewed/consolidated.
// Colores definidos en P3: "confidence con badge de color: draft gris/reviewed ámbar/
// consolidated verde".

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Confidence = "draft" | "reviewed" | "consolidated";

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  className?: string;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  draft: "Borrador",
  reviewed: "Revisado",
  consolidated: "Consolidado",
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  reviewed: "bg-primary/10 text-primary border-transparent dark:bg-primary dark:text-primary",
  consolidated: "bg-chart-2/10 text-chart-2 border-transparent dark:bg-chart-2 dark:text-chart-2",
};

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(CONFIDENCE_STYLES[confidence], className)}
      aria-label={`Confianza: ${CONFIDENCE_LABEL[confidence]}`}
    >
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}
