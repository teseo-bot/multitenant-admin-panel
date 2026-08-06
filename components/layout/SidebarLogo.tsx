"use client";

import Link from "next/link";
import { Logotipo, Marca } from "@/components/brand/logotipo";

interface SidebarLogoProps {
  expanded: boolean;
}

/**
 * Cabecera del sidebar. Alto 48px para que alinee con la barra superior: las dos
 * líneas horizontales del shell tienen que ser la misma línea.
 *
 * Expandido va el logotipo completo; colapsado, sólo el cuadro de la marca, que
 * es la pieza que funciona sola. Debajo, en qué aplicación estás — el logotipo
 * dice de quién es el producto, no cuál de los tres paneles es.
 */
export function SidebarLogo({ expanded }: SidebarLogoProps) {
  return (
    <div className="hairline-b flex shrink-0 items-center gap-2 px-3 py-2.5">
      <Link
        href="/dashboard"
        aria-label="micontexto · plano de control"
        className="flex w-full items-center gap-2 overflow-hidden"
      >
        {expanded ? (
          <span className="min-w-0 flex-1">
            <Logotipo size={22} />
            <span className="mt-1 block truncate font-mono text-[10px] leading-none text-muted-foreground">
              plano de control
            </span>
          </span>
        ) : (
          <Marca size={24} />
        )}
      </Link>
    </div>
  );
}
