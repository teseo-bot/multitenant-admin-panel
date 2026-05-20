"use client";

import Link from "next/link";
import { Command } from "lucide-react";
import { useTenantStore } from "@/stores/tenant-store";

interface SidebarLogoProps {
  expanded: boolean;
}

export function SidebarLogo({ expanded }: SidebarLogoProps) {
  const { themeConfig } = useTenantStore();
  const logoUrl = themeConfig?.logos?.fullUrl;

  return (
    <div className="flex h-16 shrink-0 items-center px-4 border-b">
      <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden w-full">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 w-auto shrink-0 rounded-md object-contain" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Command className="h-5 w-5" />
          </div>
        )}
        
        {expanded && (
          <span className="truncate font-semibold text-lg tracking-tight transition-opacity duration-200">
            {themeConfig?.logos?.fullUrl ? "" : "Command Center"}
          </span>
        )}
      </Link>
    </div>
  );
}