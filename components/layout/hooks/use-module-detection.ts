"use client";

import { usePathname } from "next/navigation";

export function useModuleDetection() {
  const pathname = usePathname() || "";

  return {
    isCommandCenter: pathname.startsWith("/command-center"),
    isAssetStudio: pathname.startsWith("/asset-studio"),
    isTenants: pathname.startsWith("/tenants"),
    isAnalytics: pathname.startsWith("/analytics"),
    isFinOps: pathname.startsWith("/finops"),
    isAlerts: pathname.startsWith("/alerts"),
    isDashboard: pathname === "/dashboard",
  };
}