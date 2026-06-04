"use client";

import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { HorizontalMenuSlot } from "./HorizontalMenuSlot";
import { usePageTitle } from "./hooks/use-page-title";
import { cn } from "@/lib/utils";

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
            className="hidden md:flex relative left-0 top-0 h-full z-40 border-r"
          />
          <SidebarInset className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
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

            <main className="flex-1 flex flex-col min-h-0 bg-muted/20">
              {children}
            </main>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
