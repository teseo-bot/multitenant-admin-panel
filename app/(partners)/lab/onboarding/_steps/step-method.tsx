// app/(partners)/lab/onboarding/_steps/step-method.tsx
// Paso 2: Explicación visual del método (Fuentes → Borradores → Validación → Publicación).

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StepMethod() {
  const steps = [
    {
      number: 1,
      title: "Fuentes",
      description: "Registra tus documentos y URLs como material base.",
      icon: "📄",
    },
    {
      number: 2,
      title: "Borradores",
      description: "Destila las fuentes en conceptos estructurados.",
      icon: "✍️",
    },
    {
      number: 3,
      title: "Validación",
      description: "El editor guiado te ayuda a pulir formato y contenido.",
      icon: "✔️",
    },
    {
      number: 4,
      title: "Publicación firmada",
      description: "Tu paquete es certificado con tu sello digital de curator.",
      icon: "🔏",
    },
  ];

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl">El método</CardTitle>
        <p className="text-muted-foreground dark:text-muted-foreground mt-2 text-sm">
          Así funciona el Knowledge Lab: convierte tu expertise en conceptos
          certificados en 4 pasos.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {steps.map((stepItem, idx) => (
            <div key={stepItem.number} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/30 flex items-center justify-center text-2xl mb-2">
                  {stepItem.icon}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-1 h-12 bg-muted dark:bg-card" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <h3 className="font-semibold text-foreground dark:text-muted-foreground">
                  {stepItem.title}
                </h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                  {stepItem.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-primary/10 dark:bg-primary/20 border border-primary/40 dark:border-primary/40 rounded-md p-4">
          <p className="text-sm text-primary dark:text-primary">
            <strong>Tu recompensa:</strong> Al publicar, tu paquete lleva el sello
            de <strong>Certificado por {"{tu_nombre}"}</strong> — tu firma digital
            de expertise.
          </p>
        </div>
      </CardContent>
    </>
  );
}
