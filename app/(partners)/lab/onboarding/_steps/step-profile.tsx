// app/(partners)/lab/onboarding/_steps/step-profile.tsx
// Paso 1: Confirmar perfil del aliado (solo lectura).

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerSummary } from "@/lib/partners/session";

interface StepProfileProps {
  partner: PartnerSummary;
}

export default function StepProfile({ partner }: StepProfileProps) {
  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl">Tu perfil</CardTitle>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2 text-sm">
          Confirma los datos de tu aliado. Este perfil firmará como curator todos
          tus conceptos en el Knowledge Lab.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground dark:text-muted-foreground">
            Razón social
          </label>
          <div className="px-4 py-3 bg-muted dark:bg-card rounded-md border border-border dark:border-border text-foreground dark:text-muted-foreground">
            {partner.legal_name}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground dark:text-muted-foreground">
            Identificador (slug)
          </label>
          <div className="px-4 py-3 bg-muted dark:bg-card rounded-md border border-border dark:border-border text-foreground dark:text-muted-foreground font-mono text-sm">
            {partner.slug}
          </div>
        </div>

        <div className="bg-primary/10 dark:bg-primary/20 border border-primary/40 dark:border-primary/40 rounded-md p-4">
          <p className="text-sm text-primary dark:text-primary">
            <strong>Nota:</strong> Estos datos son tu identidad en el Lab. Todos tus
            conceptos serán certificados bajo este nombre. Si necesitas cambios,
            contacta a Knowledge Ops.
          </p>
        </div>
      </CardContent>
    </>
  );
}
