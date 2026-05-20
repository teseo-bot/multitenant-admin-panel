"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { MenuItem } from "./types";
import { cn } from "@/lib/utils";

interface SidebarMenuItemProps {
  item: MenuItem;
  expanded: boolean;
}

export function SidebarMenuItem({ item, expanded }: SidebarMenuItemProps) {
  const pathname = usePathname() || "";
  const Icon = item.icon;
  
  const hasSubMenus = item.subMenus && item.subMenus.length > 0;
  
  const isActive = (item.href && pathname === item.href) || 
                   (hasSubMenus && item.subMenus!.some(sub => pathname.startsWith(sub.href)));

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

  const content = (
    <>
      <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
      {expanded && (
        <span className="ml-3 flex-1 truncate transition-opacity duration-200 flex items-center justify-between">
          {item.name}
          {isComingSoon && (
            <span className="text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              Pronto
            </span>
          )}
        </span>
      )}
      {expanded && hasSubMenus && !isComingSoon && (
        <div className="shrink-0 transition-transform duration-200 ml-2">
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      )}
    </>
  );

  return (
    <div className={cn("mb-1", isComingSoon && "opacity-50 cursor-not-allowed")}>
      {hasSubMenus || isComingSoon ? (
        <div 
          onClick={toggleOpen}
          className={cn(
            "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            !isComingSoon && "cursor-pointer hover:bg-accent hover:text-accent-foreground"
          )}
        >
          {content}
        </div>
      ) : (
        <Link 
          href={item.href || "#"}
          className={cn(
            "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
          )}
        >
          {content}
        </Link>
      )}

      {expanded && hasSubMenus && isOpen && !isComingSoon && (
        <div className="mt-1 space-y-1 pl-10 pr-3">
          {item.subMenus!.map((sub, index) => {
            const isSubActive = pathname === sub.href;
            return (
              <Link
                key={index}
                href={sub.href}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  isSubActive ? "font-medium text-primary" : "text-muted-foreground"
                )}
              >
                {sub.name}
                {sub.comingSoon && (
                  <span className="ml-2 text-[9px] uppercase tracking-wider bg-muted text-muted-foreground px-1 py-0.5 rounded">
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
