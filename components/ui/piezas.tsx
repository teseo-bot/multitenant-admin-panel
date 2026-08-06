import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Piezas del sistema de diseño.
 *
 * Son las formas que se repiten en las tres aplicaciones: la banda de métricas,
 * la sección con encabezado hairline, el estado vacío que enseña qué hacer, el
 * error que dice qué pasó y qué hacer, y el esqueleto de carga.
 *
 * La regla que las une: la jerarquía la dan la tipografía y el espaciado. Una
 * caja con borde separa zonas funcionales, no adorna. El color sólo aparece
 * cuando significa algo (marca, riesgo, bien).
 */

type Tono = "neutro" | "ok" | "aviso" | "riesgo";

const tonos: Record<Tono, string> = {
  neutro: "border-border bg-muted text-muted-foreground",
  ok: "border-chart-2/40 bg-chart-2/10 text-foreground",
  aviso: "border-primary/40 bg-primary/10 text-foreground",
  riesgo: "border-destructive/40 bg-destructive/10 text-destructive",
};

const puntos: Record<Tono, string> = {
  neutro: "bg-muted-foreground",
  ok: "bg-chart-2",
  aviso: "bg-primary",
  riesgo: "bg-destructive",
};

/** Etiqueta de estado. Mayúsculas en mono: se lee como dato, no como botón. */
export function Pastilla({
  children,
  tono = "neutro",
  punto,
  className,
}: {
  children: ReactNode;
  tono?: Tono;
  punto?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase leading-4",
        tonos[tono],
        className
      )}
    >
      {punto && <span className={cn("size-1.5 rounded-full", puntos[tono])} />}
      {children}
    </span>
  );
}

/** Etiqueta de sección: nombra la zona sin dibujar una tarjeta alrededor. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("label-kicker", className)}>{children}</p>;
}

/**
 * Una métrica. El número es el protagonista: mono, tabular y grande. La etiqueta
 * y el apoyo se van a 11px muted — se leen sólo si te interesan.
 */
export function Metrica({
  etiqueta,
  valor,
  apoyo,
  tono,
}: {
  etiqueta: string;
  valor: ReactNode;
  apoyo?: ReactNode;
  tono?: "ok" | "riesgo";
}) {
  return (
    <div className="px-4 py-3">
      <p className="label-kicker">{etiqueta}</p>
      <p className="mt-1.5 font-mono text-xl font-semibold leading-none tracking-tight">{valor}</p>
      {apoyo && (
        <p
          className={cn(
            "mt-1.5 text-[11px] leading-none",
            tono === "ok" && "text-chart-2",
            tono === "riesgo" && "text-destructive",
            !tono && "text-muted-foreground"
          )}
        >
          {apoyo}
        </p>
      )}
    </div>
  );
}

/**
 * Banda de métricas: celdas separadas por 1px de borde, sin tarjetas.
 * Cuatro tarjetas con sombra compiten entre sí; una rejilla hairline se lee
 * como una sola unidad de información.
 */
export function BandaMetricas({
  children,
  columnas = 4,
  className,
}: {
  children: ReactNode;
  columnas?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid-hairline rounded-md border border-border",
        columnas === 2 && "grid-cols-1 sm:grid-cols-2",
        columnas === 3 && "grid-cols-1 sm:grid-cols-3",
        columnas === 4 && "grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Sección con encabezado hairline. Sustituye a Card + CardHeader + CardTitle. */
export function Seccion({
  titulo,
  descripcion,
  acciones,
  children,
  sinPadding,
  className,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  sinPadding?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <header className="hairline-b flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight">{titulo}</h2>
          {descripcion && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{descripcion}</p>
          )}
        </div>
        {acciones && <div className="ml-auto flex shrink-0 items-center gap-2">{acciones}</div>}
      </header>
      <div className={cn(!sinPadding && "p-3")}>{children}</div>
    </section>
  );
}

/**
 * Estado vacío. Obligatorio: decir qué va a aparecer aquí y qué hacer para que
 * aparezca. «Sin datos» no es un estado vacío, es una disculpa.
 */
export function Vacio({
  titulo,
  descripcion,
  accion,
  className,
}: {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <p className="text-sm font-medium">{titulo}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {descripcion}
      </p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

/**
 * Error de zona. Dice qué pasó y qué hacer. Nunca un código ni un stack: si el
 * usuario no puede actuar sobre el texto, el texto sobra.
 */
export function ErrorZona({
  que,
  queHacer,
  accion,
  className,
}: {
  que: string;
  queHacer: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{que}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{queHacer}</p>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

/** Carga: esqueleto con la forma del contenido, nunca un spinner centrado. */
export function EsqueletoFilas({ filas = 6 }: { filas?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2.5">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="ml-auto h-3.5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoMetricas({ celdas = 4 }: { celdas?: number }) {
  return (
    <BandaMetricas columnas={4}>
      {Array.from({ length: celdas }).map((_, i) => (
        <div key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-6 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </BandaMetricas>
  );
}

/**
 * Barra de proporción. Sin degradados: el ancho ya dice el valor.
 * `de` a 0 no pinta barra — una barra llena para «0 de 0» miente.
 */
export function Barra({
  valor,
  de,
  tono = "neutro",
  className,
}: {
  valor: number;
  de: number;
  /** El color sólo si significa algo. Por defecto la barra es neutra: lo que
   *  comunica es el largo, no el tono. */
  tono?: "neutro" | "marca" | "ok" | "riesgo";
  className?: string;
}) {
  const pct = de > 0 ? Math.min(100, Math.max(0, (valor / de) * 100)) : 0;
  return (
    <span
      className={cn(
        "relative block h-1 flex-1 overflow-hidden rounded-full bg-border",
        className
      )}
    >
      {/* El relleno tiene que separarse del carril: a `muted-foreground/60` la
          barra neutra quedaba casi invisible sobre `border` y dejaba de decir
          nada. Sin color de marca, pero visible. */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width]",
          tono === "neutro" && "bg-foreground/70",
          tono === "marca" && "bg-primary",
          tono === "ok" && "bg-chart-2",
          tono === "riesgo" && "bg-destructive"
        )}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
