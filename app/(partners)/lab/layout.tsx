// app/(partners)/lab/layout.tsx
// KL1-W1: guard server-side del Knowledge Lab de aliados.
//
// Espeja app/(control-panel)/knowledge-ops/layout.tsx (requirePlatformAdmin +
// redirect()) y app/(control-panel)/layout.tsx (SidebarProvider/SidebarInset):
// aquí el guard es requirePartnerMember() — sesión Identity Platform + membership
// real en partner_members (RP-KL7). 401 => login; 403 => /unauthorized (misma ruta
// que usa el resto del panel).

import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePartnerMember } from "@/lib/partners/session";
import { LabSidebar } from "@/components/layout/lab-sidebar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const guard = await requirePartnerMember();

  if (!guard.ok) {
    if (guard.status === 401) {
      redirect("/auth/login?redirectTo=/lab");
    }
    redirect("/unauthorized");
  }

  // Si onboarded_at IS NULL, redirige al wizard de onboarding
  // (solo la primera vez que accede al Lab)
  if (guard.onboarded_at === null) {
    redirect("/lab/onboarding");
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <LabSidebar partner={guard.partner} memberRole={guard.member_role} />
        <SidebarInset className="min-w-0 overflow-y-auto w-full h-screen flex-1 flex flex-col">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
