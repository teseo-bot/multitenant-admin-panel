"use client";

import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { HorizontalMenuSlot } from "./HorizontalMenuSlot";
import { useSidebarState } from "./hooks/use-sidebar-state";
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
  const { expanded, toggleSidebar, isMounted } = useSidebarState(true);
  const title = usePageTitle();

  // Avoid hydration mismatch on sidebar width by forcing expanded initially 
  // or hiding transitions until mounted.
  const sidebarWidthClass = !isMounted 
    ? "md:ml-[260px]" // SSR default
    : expanded 
      ? "md:ml-[260px]" 
      : "md:ml-[64px]";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppSidebar 
        expanded={isMounted ? expanded : true} 
        onToggle={toggleSidebar} 
        user={user} 
        onLogout={onLogout}
        className="hidden md:flex"
      />
      
      <div 
        className={cn(
          "flex flex-col flex-1 transition-[margin] duration-300 ease-in-out",
          sidebarWidthClass
        )}
      >
        <AppTopBar 
          expanded={isMounted ? expanded : true} 
          onToggleSidebar={toggleSidebar} 
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
      </div>
    </div>
  );
}