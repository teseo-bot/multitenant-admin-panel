"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "./AppSidebar";
import { useState } from "react";

interface AppTopBarProps {
  expanded: boolean;
  onToggleSidebar: () => void;
  title: string;
  user: {
    name?: string;
    email: string;
    role?: string;
    avatar_url?: string;
  };
  onLogout?: () => void;
}

export function AppTopBar({ expanded, onToggleSidebar, title, user, onLogout }: AppTopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 shadow-sm sm:px-6">
      {/* Mobile Sidebar Trigger (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[260px]">
          {/* We render a duplicate sidebar inside the sheet but force it expanded */}
          <AppSidebar 
            expanded={true} 
            onToggle={() => setMobileOpen(false)} 
            user={user} 
            onLogout={onLogout} 
          />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar Toggle */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onToggleSidebar}
        className="hidden md:flex text-muted-foreground hover:text-foreground"
      >
        {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Page Title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      {/* TopBar Actions (Notifications, etc) can go here */}
      <div className="flex items-center gap-2">
        {/* Placeholder for future actions */}
      </div>
    </header>
  );
}