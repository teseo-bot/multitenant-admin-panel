// app/(partners)/lab/onboarding/page.tsx
// KL1-W2: wizard de onboarding de primera sesión del aliado.
//
// 3 pasos: (1) Tu perfil (read-only), (2) El método (explicación), (3) Tu primer paquete (formulario)
// El check de onboarding está en app/(partners)/lab/layout.tsx; esta página está FUERA del
// check porque es su propia ruta. Se redirige aquí desde el layout si onboarded_at IS NULL.

import { redirect } from "next/navigation";
import { requirePartnerMember } from "@/lib/partners/session";
import OnboardingWizard from "./_wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const guard = await requirePartnerMember();

  if (!guard.ok) {
    if (guard.status === 401) {
      redirect("/auth/login?redirectTo=/lab/onboarding");
    }
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <OnboardingWizard
        partner={guard.partner}
        memberRole={guard.member_role}
      />
    </div>
  );
}
