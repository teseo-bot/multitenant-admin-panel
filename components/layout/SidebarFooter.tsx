"use client";

import { LogOut, Palette, Shield, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import pkg from "../../package.json";

interface SidebarFooterProps {
  expanded: boolean;
  user: {
    name?: string;
    email: string;
    role?: string;
    avatar_url?: string;
  };
  onLogout?: () => void;
}

const nombreDeRol: Record<string, string> = {
  owner: "Propietaria de la cuenta",
  admin: "Administración",
  member: "Equipo comercial",
  viewer: "Sólo lectura",
};

export function SidebarFooter({ expanded, user, onLogout }: SidebarFooterProps) {
  const iniciales = (() => {
    if (user.name) {
      const partes = user.name.trim().split(/\s+/);
      if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
      return user.name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  })();

  // Bajo el nombre va el rol, no el correo: el correo ya lo sabe: es suyo. El
  // rol explica por qué ve unas pantallas y no otras.
  const subtitulo = (user.role && nombreDeRol[user.role]) || user.email;

  return (
    <div className="hairline-t p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors duration-100 hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
            !expanded && "justify-center px-0"
          )}
        >
          <Avatar className="size-6 shrink-0">
            <AvatarImage src={user.avatar_url} alt="" />
            <AvatarFallback className="bg-accent font-mono text-[10px] font-semibold text-accent-foreground">
              {iniciales}
            </AvatarFallback>
          </Avatar>
          {expanded && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight text-sidebar-foreground">
                {user.name || user.email}
              </span>
              <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                {subtitulo}
              </span>
            </span>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56" align="start" side="top">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-[13px] font-medium leading-none">
              {user.name || "Tu cuenta"}
            </p>
            <p className="mt-1 truncate font-mono text-[11px] leading-none text-muted-foreground">
              {user.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/profile" />}>
              <User className="mr-2 size-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              render={<Link href="/settings/appearance" />}
            >
              <Palette className="mr-2 size-4" />
              <span>Apariencia</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              render={<Link href="/settings/security" />}
            >
              <Shield className="mr-2 size-4" />
              <span>Seguridad</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={onLogout as unknown as string}>
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
    </div>
  );
}
