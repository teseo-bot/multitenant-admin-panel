// components/knowledge-ops/AltitudeChip.tsx
// UXUI-OKF-Knowledge-Ops.md — tabla "Componentes compartidos nuevos":
// AltitudeChip { altitude: 1-5 } — color: 1-2 gris, 3 azul, 4 ámbar, 5 rojo.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AltitudeChipProps {
  altitude: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

const ALTITUDE_STYLES: Record<number, string> = {
  1: "bg-muted text-muted-foreground border-transparent",
  2: "bg-muted text-muted-foreground border-transparent",
  3: "bg-primary/10 text-primary border-transparent dark:bg-primary dark:text-primary",
  4: "bg-primary/10 text-primary border-transparent dark:bg-primary dark:text-primary",
  5: "bg-destructive/10 text-destructive border-transparent dark:bg-destructive dark:text-destructive",
};

export function AltitudeChip({ altitude, className }: AltitudeChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(ALTITUDE_STYLES[altitude] ?? ALTITUDE_STYLES[1], className)}
      aria-label={`Altitud ${altitude}`}
    >
      A{altitude}
    </Badge>
  );
}
