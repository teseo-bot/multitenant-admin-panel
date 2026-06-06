"use client"

import { LayoutDashboard, Users, Building2, LogOut, Palette, Shield, User as UserIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import pkg from "../../package.json"
import { logoutAction } from "@/app/(auth)/actions"

export function ControlPanelSidebar({ user }: { user?: any }) {
  const getInitials = () => {
    if (user?.user_metadata?.name) {
      return user.user_metadata.name.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "US";
  };

  return (
    <Sidebar>
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel>Platform Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/admin" />}>
                  <LayoutDashboard />
                  <span>Control Panel</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/tenants" />}>
                  <Building2 />
                  <span>Tenants</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/tenants" />}>
                      <span>Estado</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/tenants/database" />}>
                      <span>Base de Datos</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/admin/users" />}>
                  <Users />
                  <span>Users</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t flex flex-col gap-4">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none focus:ring-0 border-0 bg-transparent p-0 w-full">
              <div className="flex items-center gap-3 cursor-pointer rounded-md p-1 hover:bg-muted transition-colors text-left">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden flex-1 text-left">
                  <span className="truncate text-sm font-medium">{user.user_metadata?.name || "User"}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <div className="font-normal px-2 py-1.5 text-sm">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.user_metadata?.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href="/settings/profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href="/settings/appearance">
                    <Palette className="mr-2 h-4 w-4" />
                    <span>Apariencia</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500" asChild>
                  <Link href="/settings/security">
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Seguridad</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <button type="submit" className="w-full text-left">
                  <DropdownMenuItem className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="text-center w-full">
          <span className="text-[10px] font-mono text-muted-foreground/50 select-none">
            v{pkg.version}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
