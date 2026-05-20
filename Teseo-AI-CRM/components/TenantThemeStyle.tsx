"use client";

import { useTenantTheme } from "@/hooks/useTenantTheme";

export function TenantThemeStyle() {
  const { cssOverrides } = useTenantTheme();
  
  if (!cssOverrides) return null;
  
  return <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />;
}
