// app/(partners)/lab/onboarding/_wizard.tsx
// Componente cliente del wizard de onboarding (3 pasos).

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PartnerSummary, PartnerMemberRole } from "@/lib/partners/session";
import StepProfile from "./_steps/step-profile";
import StepMethod from "./_steps/step-method";
import StepPackage from "./_steps/step-package";

interface OnboardingWizardProps {
  partner: PartnerSummary;
  memberRole: PartnerMemberRole;
}

export default function OnboardingWizard({
  partner,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepPackageRef = useRef<{ submit: () => Promise<boolean> }>(null);

  const handleStepChange = (newStep: 1 | 2 | 3) => {
    setStep(newStep);
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Si estamos en paso 3, primero crear el paquete
      if (step === 3 && stepPackageRef.current) {
        const packageCreated = await stepPackageRef.current.submit();
        if (!packageCreated) {
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch("/api/partners/me/onboarding-complete", {
        method: "POST",
      });

      if (response.ok) {
        // Redirige al home del Lab
        router.push("/lab");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    // Skip también marca como onboarded (sin crear paquete)
    await handleComplete();
  };

  const handleNext = async () => {
    // Si estamos en paso 3, validar antes de avanzar
    if (step === 3 && stepPackageRef.current) {
      const packageCreated = await stepPackageRef.current.submit();
      if (!packageCreated) {
        return;
      }
    }
    if (step < 3) {
      handleStepChange((step + 1) as 1 | 2 | 3);
    }
  };

  return (
    // Sin degradado de fondo: el lienzo plano es el mismo del resto del panel y
    // evita que el onboarding parezca otra aplicación.
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Indicador de progreso */}
        <div className="mb-8 flex justify-between items-center">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  step >= s
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground dark:bg-card"
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    step > s
                      ? "bg-primary"
                      : "bg-muted dark:bg-card"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Contenido del paso */}
        <Card className="shadow-lg">
          {step === 1 && <StepProfile partner={partner} />}
          {step === 2 && <StepMethod />}
          {step === 3 && (
            <StepPackage partner={partner} ref={stepPackageRef} />
          )}

          {/* Botones de navegación */}
          <CardContent className="pt-6 border-t flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => handleStepChange((step - 1) as 1 | 2 | 3)}
              disabled={step === 1 || isSubmitting}
            >
              Atrás
            </Button>

            <div className="flex gap-2">
              {step === 3 && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Omitir por ahora
                </Button>
              )}

              {step < 3 && (
                <Button
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  Siguiente
                </Button>
              )}

              {step === 3 && (
                <Button onClick={handleComplete} disabled={isSubmitting}>
                  {isSubmitting ? "Completando..." : "Completar"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
