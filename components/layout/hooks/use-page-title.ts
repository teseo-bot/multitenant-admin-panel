"use client";

import { usePathname } from "next/navigation";
import { crmMenuItems } from "../menu-items";

export function usePageTitle(): string {
  const pathname = usePathname();

  if (!pathname) return "Mission Control";

  // Check direct matches in main menu or submenus
  for (const item of crmMenuItems) {
    if (item.href === pathname) return item.name;
    
    if (item.subMenus) {
      const subMatch = item.subMenus.find((sub) => sub.href === pathname);
      if (subMatch) {
        return `${item.name} / ${subMatch.name}`;
      }
    }
  }

  // Segment fallback (e.g. /tenants/123 -> Tenants)
  const mainSegment = pathname.split('/')[1];
  if (mainSegment) {
    const formatted = mainSegment.charAt(0).toUpperCase() + mainSegment.slice(1).replace(/-/g, ' ');
    return formatted;
  }

  return "Mission Control";
}