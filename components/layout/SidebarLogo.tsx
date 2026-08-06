"use client";

import Link from "next/link";
import { useTenantStore } from "@/stores/tenant-store";

interface SidebarLogoProps {
  expanded: boolean;
}

/**
 * Cabecera del sidebar. Alto 48px para que alinee con la barra superior: las dos
 * líneas horizontales del shell tienen que ser la misma línea.
 *
 * Sin logo del tenant, el monograma. Debajo, la organización — el usuario tiene
 * que saber en qué cuenta está sin buscarlo.
 */
export function SidebarLogo({ expanded }: SidebarLogoProps) {
  const { themeConfig } = useTenantStore();
  const logoUrl = themeConfig?.logos?.fullUrl;

  return (
    <div className="hairline-b flex h-12 shrink-0 items-center gap-2 px-3">
      <Link href="/dashboard" className="flex w-full items-center gap-2 overflow-hidden">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-6 w-auto max-w-[24px] shrink-0 rounded-[4px] object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-primary font-mono text-[11px] font-bold text-primary-foreground"
          >
            mc
          </span>
        )}

        {expanded && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-none text-sidebar-foreground">
              micontexto
            </span>
            <span className="mt-1 block truncate font-mono text-[10px] leading-none text-muted-foreground">
              plano de control
            </span>
          </span>
        )}
      </Link>
    </div>
  );
}
