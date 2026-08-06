"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { MenuItem } from "./types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarMenuItemProps {
  item: MenuItem;
  expanded: boolean;
}

/**
 * Elemento de navegación.
 *
 * El estado activo es un riel de 2px en el color de marca más un fondo apenas
 * perceptible, no un bloque relleno: en una lista de diez elementos, un bloque
 * de color compite con el contenido de la pantalla y es lo primero que delata
 * una interfaz generada. El riel se lee igual de rápido y no grita.
 */
export function SidebarMenuItem({ item, expanded }: SidebarMenuItemProps) {
  const pathname = usePathname() || "";
  const Icon = item.icon;

  const hasSubMenus = item.subMenus && item.subMenus.length > 0;

  const isActive =
    (item.href && pathname === item.href) ||
    (hasSubMenus && item.subMenus!.some((sub) => pathname.startsWith(sub.href)));

  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (!expanded) {
      setIsOpen(false);
    } else if (isActive) {
      setIsOpen(true);
    }
  }, [expanded, isActive]);

  const toggleOpen = (e: React.MouseEvent) => {
    if (item.comingSoon) {
      e.preventDefault();
      return;
    }
    if (hasSubMenus && expanded) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const isComingSoon = item.comingSoon;

  const filaBase = cn(
    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-100",
    isActive
      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
    isComingSoon && "cursor-not-allowed opacity-50 hover:bg-transparent"
  );

  const contenido = (
    <>
      <span className="relative flex shrink-0 items-center">
        {isActive && (
          <span aria-hidden className="absolute -left-2 h-4 w-[2px] rounded-full bg-primary" />
        )}
        <Icon className="size-4" />
      </span>
      {expanded && (
        <>
          <span className="flex-1 truncate">{item.name}</span>
          {isComingSoon && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Pronto
            </span>
          )}
          {hasSubMenus && !isComingSoon && (
            <span className="shrink-0 text-muted-foreground">
              {isOpen ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </span>
          )}
        </>
      )}
    </>
  );

  const fila =
    hasSubMenus || isComingSoon ? (
      <div
        onClick={toggleOpen}
        role={isComingSoon ? undefined : "button"}
        tabIndex={isComingSoon ? undefined : 0}
        onKeyDown={(e) => {
          if (!isComingSoon && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(filaBase, !isComingSoon && "cursor-pointer")}
      >
        {contenido}
      </div>
    ) : (
      <Link href={item.href || "#"} className={filaBase}>
        {contenido}
      </Link>
    );

  return (
    <div>
      {/* Colapsado no hay etiqueta: sin tooltip, el icono es una adivinanza. */}
      {expanded ? (
        fila
      ) : (
        <Tooltip>
          <TooltipTrigger render={fila} />
          <TooltipContent side="right" className="text-xs">
            {item.name}
            {isComingSoon && " · Pronto"}
          </TooltipContent>
        </Tooltip>
      )}

      {expanded && hasSubMenus && isOpen && !isComingSoon && (
        <div className="mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3 ml-[15px]">
          {item.subMenus!.map((sub, index) => {
            const isSubActive = pathname === sub.href;
            return (
              <Link
                key={index}
                href={sub.href}
                className={cn(
                  "block truncate rounded-md px-2 py-1 text-[12px] transition-colors duration-100",
                  isSubActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-sidebar-foreground"
                )}
              >
                {sub.name}
                {sub.comingSoon && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pronto
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
