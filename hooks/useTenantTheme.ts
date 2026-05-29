"use client";

import { useEffect, useState } from "react";
import { useTenantStore } from "@/stores/tenant-store";
import { buildThemeCss } from "@/lib/theme/theme-utils";

export function useTenantTheme() {
  const { themeConfig, primaryColor, setThemeConfig } = useTenantStore();
  const [cssOverrides, setCssOverrides] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenantConfig() {
      try {
        const res = await fetch("/api/tenant/config");
        if (res.ok) {
          const config = await res.json();
          // The API returns { branding: { primaryColor, accentColor, logoUrl, themeMode } }
          if (config && config.branding) {
             setThemeConfig({
               primaryColor: config.branding.primaryColor,
               appearance: { themeMode: config.branding.themeMode },
               logos: { fullUrl: config.branding.logoUrl }
             });
          }
        }
      } catch (err) {
        console.error("Failed to fetch tenant config", err);
      }
    }
    
    fetchTenantConfig();
  }, [setThemeConfig]);

  useEffect(() => {
    // Generate CSS
    const css = buildThemeCss(themeConfig, primaryColor);
    setCssOverrides(css);
  }, [themeConfig, primaryColor]);

  return { cssOverrides };
}
