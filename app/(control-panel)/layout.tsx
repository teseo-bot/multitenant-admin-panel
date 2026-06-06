import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ControlPanelSidebar } from "@/components/layout/control-panel-sidebar";
import { createClient } from "@/utils/supabase/server";

export default async function ControlPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <ControlPanelSidebar user={data?.user} />
        <SidebarInset className="min-w-0 overflow-y-auto w-full h-screen flex-1 flex flex-col">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
