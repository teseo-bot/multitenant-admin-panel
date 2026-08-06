"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { useState, type ReactNode } from "react";

interface AppTopBarProps {
  expanded: boolean;
  onToggleSidebar: () => void;
  title: string;
  user: {
    name?: string;
    email: string;
    role?: string;
    avatar_url?: string;
  };
  onLogout?: () => void;
  acciones?: ReactNode;
}

/**
 * Barra superior. 48px, sin sombra y sin fondo propio: la línea hairline basta
 * para separarla del contenido. Una sombra en una herramienta que se usa ocho
 * horas al día es ruido que se paga en cada scroll.
 *
 * El título vive aquí y sólo aquí — las pantallas no repiten su nombre en un h1.
 */
export function AppTopBar({
  expanded,
  onToggleSidebar,
  title,
  user,
  onLogout,
  acciones,
}: AppTopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="hairline-b sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 bg-background px-3 sm:px-4">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden">
          <Menu className="size-4" />
          <span className="sr-only">Abrir el menú</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[216px] p-0">
          <AppSidebar
            expanded={true}
            onToggle={() => setMobileOpen(false)}
            user={user}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={expanded ? "Colapsar el menú" : "Expandir el menú"}
        className="hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
      >
        {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      </button>

      <h1 className="truncate text-[13px] font-semibold tracking-tight">{title}</h1>

      {acciones && <div className="ml-auto flex items-center gap-2">{acciones}</div>}
    </header>
  );
}
