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
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
          Confirma los datos de tu aliado. Este perfil firmará como curator todos
          tus conceptos en el Knowledge Lab.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Razón social
          </label>
          <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
            {partner.legal_name}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Identificador (slug)
          </label>
          <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm">
            {partner.slug}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Nota:</strong> Estos datos son tu identidad en el Lab. Todos tus
            conceptos serán certificados bajo este nombre. Si necesitas cambios,
            contacta a Knowledge Ops.
          </p>
        </div>
      </CardContent>
    </>
  );
}
