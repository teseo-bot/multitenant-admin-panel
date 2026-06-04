import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ControlPanelSidebar } from "@/components/layout/control-panel-sidebar";

export default function ControlPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <ControlPanelSidebar />
        <SidebarInset className="min-w-0 overflow-y-auto w-full h-screen flex-1 flex flex-col">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
