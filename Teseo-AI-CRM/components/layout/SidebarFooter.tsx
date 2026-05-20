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

interface SidebarFooterProps {
  expanded: boolean;
  user: {
    name?: string;
    email: string;
    avatar_url?: string;
  };
  onLogout?: () => void;
}

export function SidebarFooter({ expanded, user, onLogout }: SidebarFooterProps) {
  const getInitials = () => {
    if (user.name) {
      const parts = user.name.split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return user.name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="border-t p-4 flex flex-col gap-4">
      {/* User Info & Avatar wrapped in DropdownMenu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none focus:ring-0 border-0 bg-transparent p-0 w-full">
          <div className={cn(
            "flex items-center gap-3 cursor-pointer rounded-md p-1 hover:bg-muted transition-colors text-left", 
            !expanded && "justify-center"
          )}>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            {expanded && (
              <div className="flex flex-col overflow-hidden flex-1 text-left">
                <span className="truncate text-sm font-medium">{user.name || "User"}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <div className="font-normal px-2 py-1.5 text-sm">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/profile" />}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" render={<Link href="/settings/appearance" />}>
              <Palette className="mr-2 h-4 w-4" />
              <span>Apariencia</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-red-500 focus:text-red-500" render={<Link href="/settings/security" />}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Seguridad</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={onLogout as unknown as string}>
            <button type="submit" className="w-full text-left">
              <DropdownMenuItem className="cursor-pointer" render={<div />}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}