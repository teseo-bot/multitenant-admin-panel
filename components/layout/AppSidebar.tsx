"use client";

import { SidebarLogo } from "./SidebarLogo";
import { SidebarMenuItem } from "./SidebarMenuItem";
import { SidebarFooter } from "./SidebarFooter";
import { crmMenuItems } from "./menu-items";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppSidebarProps {
  expanded: boolean;
  onToggle?: () => void;
  user: {
    name?: string;
    email: string;
    role?: string;
    avatar_url?: string;
  };
  onLogout?: () => void;
  className?: string;
}

export function AppSidebar({ expanded, user, onLogout, className }: AppSidebarProps) {
  // Role-based filtering
  const visibleItems = crmMenuItems.filter(item => {
    if (!item.allowedRoles) return true;
    if (!user.role) return false;
    return item.allowedRoles.includes(user.role);
  });

  return (
    <aside
      className={cn(
        // El sidebar es chrome, no contenido: bg-sidebar lo separa del lienzo
        // sin necesidad de sombra, y un hairline hace de límite.
        "hairline-r relative z-40 flex h-screen flex-col bg-sidebar transition-[width] duration-150 ease-out",
        expanded ? "w-[216px]" : "w-[52px]",
        className
      )}
    >
      <SidebarLogo expanded={expanded} />

      <ScrollArea className="min-h-0 flex-1 py-2">
        <nav className={cn("space-y-0.5", expanded ? "px-2" : "px-1.5")}>
          {visibleItems.map((item, index) => (
            <SidebarMenuItem 
              key={index} 
              item={item} 
              expanded={expanded} 
            />
          ))}
        </nav>
      </ScrollArea>

      <SidebarFooter 
        expanded={expanded} 
        user={user} 
        onLogout={onLogout} 
      />
    </aside>
  );
}