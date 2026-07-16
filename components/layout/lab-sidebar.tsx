"use client"

// KL1-W1: sidebar del Knowledge Lab de aliados. Espeja components/layout/control-panel-sidebar.tsx
// (mismos primitivos de components/ui/sidebar) — audiencia distinta (aliados, no platform_admin).

import { Home, Library, PackageOpen, FileSignature, BarChart3, LogOut } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"

import Link from "next/link"
import { logoutAction } from "@/app/(auth)/actions"
import type { PartnerSummary, PartnerMemberRole } from "@/lib/partners/session"

const NAV_ITEMS = [
  { href: "/lab", label: "Inicio", icon: Home },
  { href: "/lab/fuentes", label: "Fuentes", icon: Library },
  { href: "/lab/paquetes", label: "Paquetes", icon: PackageOpen },
  { href: "/lab/contratos", label: "Contratos", icon: FileSignature },
  { href: "/lab/metricas", label: "Métricas", icon: BarChart3 },
] as const

export function LabSidebar({
  partner,
  memberRole,
}: {
  partner: PartnerSummary
  memberRole: PartnerMemberRole
}) {
  return (
    <Sidebar>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel>Knowledge Lab</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton render={<Link href={href} />}>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t flex flex-col gap-3">
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-medium">{partner.legal_name}</span>
          <span className="truncate text-xs text-muted-foreground capitalize">
            Rol: {memberRole}
          </span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
