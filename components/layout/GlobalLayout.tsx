"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { HorizontalMenuSlot } from "./HorizontalMenuSlot";
import { usePageTitle } from "./hooks/use-page-title";

interface GlobalLayoutProps {
  children: ReactNode;
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    avatar_url?: string;
  };
  horizontalNav?: ReactNode;
  onLogout?: () => void;
}

export function GlobalLayout({ children, user, horizontalNav, onLogout }: GlobalLayoutProps) {
  const title = usePageTitle();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex flex-col w-full">
        <div className="flex flex-1 overflow-hidden w-full h-screen">
          <AppSidebar
            expanded={true}
            user={user}
            onLogout={onLogout}
            className="relative left-0 top-0 z-40 hidden h-full md:flex"
          />
          <SidebarInset className="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto">
            <AppTopBar
              expanded={true}
              onToggleSidebar={() => {}}
              title={title}
              user={user}
              onLogout={onLogout}
            />

            <HorizontalMenuSlot>
              {horizontalNav}
            </HorizontalMenuSlot>

            {/* El lienzo es `background`, no un gris intermedio: las secciones se
                recortan contra él con `card` + hairline, sin sombra. */}
            <main className="flex min-h-0 flex-1 flex-col bg-background">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
