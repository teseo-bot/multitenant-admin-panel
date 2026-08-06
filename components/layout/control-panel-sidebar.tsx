"use client"

import { LayoutDashboard, Users, Building2, LogOut, Palette, Shield, User as UserIcon, ScrollText, BrainCircuit, Handshake } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import pkg from "../../package.json"
import { logoutAction } from "@/app/(auth)/actions"
import { Logotipo } from "@/components/brand/logotipo"

// Este es el sidebar que ve casi todo el plano de control: el grupo de rutas
// `(control-panel)` (administración, cuentas, auditoría, aliados). El de
// `components/layout/AppSidebar.tsx` sólo lo usa `/finops`.
//
// Los rótulos van en español: «Platform Admin», «Control Panel» y «Users»
// describían quién escribió la pantalla, no la tarea de quien la usa.

const CLASE_FILA =
  "h-auto gap-2.5 px-2 py-1.5 text-[13px] data-active:bg-sidebar-accent data-active:font-medium"

export function ControlPanelSidebar({ user }: { user?: any }) {
  // UXUI-OKF-Knowledge-Ops.md §0: entrada "Knowledge Ops" visible SOLO platform_admin.
  // Mismo flag explícito que lib/auth/guards.ts (isPlatformAdmin): NUNCA por email.
  const isPlatformAdmin = user?.platformAdmin === true;
  const pathname = usePathname() || "";

  // Sin esto ninguna entrada se marcaba: el usuario no sabía en qué sección
  // estaba salvo por el título de la página.
  const activo = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const iniciales = user?.email ? user.email.substring(0, 2).toUpperCase() : "US";

  return (
    <Sidebar>
      <SidebarHeader className="hairline-b justify-center px-3 py-2.5">
        <Link
          href="/admin"
          aria-label="micontexto · plano de control"
          className="flex items-center gap-2 overflow-hidden"
        >
          <span className="min-w-0 flex-1">
            <Logotipo size={22} />
            <span className="mt-1 block truncate font-mono text-[10px] leading-none text-muted-foreground">
              plano de control
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup className="px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={CLASE_FILA}
                  data-active={activo("/admin") || undefined}
                  render={<Link href="/admin" />}
                >
                  <LayoutDashboard />
                  <span>Resumen</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  className={CLASE_FILA}
                  data-active={activo("/tenants") || undefined}
                  render={<Link href="/tenants" />}
                >
                  <Building2 />
                  <span>Cuentas</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      data-active={pathname === "/tenants" || undefined}
                      render={<Link href="/tenants" />}
                    >
                      <span>Estado</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      data-active={activo("/tenants/database") || undefined}
                      render={<Link href="/tenants/database" />}
                    >
                      <span>Base de datos</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  className={CLASE_FILA}
                  data-active={activo("/admin/users") || undefined}
                  render={<Link href="/admin/users" />}
                >
                  <Users />
                  <span>Usuarios</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  className={CLASE_FILA}
                  data-active={activo("/admin/audit") || undefined}
                  render={<Link href="/admin/audit" />}
                >
                  <ScrollText />
                  <span>Auditoría</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className={CLASE_FILA}
                    data-active={activo("/knowledge-ops") || undefined}
                    render={<Link href="/knowledge-ops" />}
                  >
                    <BrainCircuit />
                    <span>Conocimiento</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className={CLASE_FILA}
                    data-active={activo("/admin/aliados") || undefined}
                    render={<Link href="/admin/aliados" />}
                  >
                    <Handshake />
                    <span>Aliados</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        data-active={pathname === "/admin/aliados" || undefined}
                        render={<Link href="/admin/aliados" />}
                      >
                        <span>Alta y directorio</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        data-active={activo("/admin/catalogo-aliados") || undefined}
                        render={<Link href="/admin/catalogo-aliados" />}
                      >
                        <span>Catálogo</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="hairline-t p-2">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
                  {iniciales}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium leading-tight">
                  {user.email || "Tu cuenta"}
                </span>
                <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                  {isPlatformAdmin ? "Administración de la plataforma" : "Operación"}
                </span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start" side="top">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-[13px] font-medium leading-none">
                  {user.email || "Tu cuenta"}
                </p>
                <p className="mt-1 truncate font-mono text-[11px] leading-none text-muted-foreground">
                  {user.id}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/profile" />}>
                  <UserIcon className="mr-2 size-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/appearance" />}>
                  <Palette className="mr-2 size-4" />
                  <span>Apariencia</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/security" />}>
                  <Shield className="mr-2 size-4" />
                  <span>Seguridad</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <button type="submit" className="w-full text-left">
                  <DropdownMenuItem className="cursor-pointer" render={<div />}>
                    <LogOut className="mr-2 size-4" />
                    <span>Cerrar sesión</span>
                  </DropdownMenuItem>
                </button>
              </form>
              <DropdownMenuSeparator />
              <p className="px-2 py-1 font-mono text-[10px] text-muted-foreground">v{pkg.version}</p>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
