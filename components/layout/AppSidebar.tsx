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
        "relative flex z-40 h-screen flex flex-col bg-card border-r transition-[width] duration-300 ease-in-out",
        expanded ? "w-[260px]" : "w-[64px]",
        className
      )}
    >
      <SidebarLogo expanded={expanded} />

      <ScrollArea className="flex-1 py-4">
        <nav className="px-2 space-y-1">
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