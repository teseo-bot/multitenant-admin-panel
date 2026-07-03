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
  3: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300",
  4: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  5: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
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
