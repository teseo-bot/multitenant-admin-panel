// app/(partners)/lab/onboarding/_steps/step-package.tsx
// Paso 3: Crear el primer paquete (formulario).

"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PartnerSummary } from "@/lib/partners/session";

const HOCFLIT_SYSTEMS = [
  { value: "h-talento-humano", label: "Talento Humano" },
  { value: "o-operaciones", label: "Operaciones" },
  { value: "c-comercial", label: "Comercial" },
  { value: "f-finanzas", label: "Finanzas" },
  { value: "l-legal", label: "Legal" },
  { value: "i-innovacion", label: "Innovación" },
  { value: "t-tecnologia", label: "Tecnología" },
];

interface StepPackageProps {
  partner: PartnerSummary;
}

const StepPackage = forwardRef(function StepPackageContent(
  _props: StepPackageProps,
  ref
) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [systems, setSystems] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packageCreated, setPackageCreated] = useState(false);

  // Auto-generar slug desde título
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    // Generar slug automático si no ha sido editado manualmente
    if (!slug || slug === generateSlug(title)) {
      setSlug(generateSlug(newTitle));
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60);
  };

  const toggleSystem = (value: string) => {
    setSystems((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (): Promise<boolean> => {
    setError("");

    // Validación básica de cliente
    if (!title.trim()) {
      setError("El título es requerido");
      return false;
    }
    if (!slug.trim()) {
      setError("El slug es requerido");
      return false;
    }
    if (systems.length === 0) {
      setError("Debe seleccionar al menos un sistema");
      return false;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/partners/me/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          systems,
          altitude_max: 3,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Error al crear el paquete");
        return false;
      }

      // Éxito
      const createdPackage = await response.json();
      console.log("Paquete creado:", createdPackage);
      setPackageCreated(true);
      return true;
    } catch (err) {
      setError("Error de conexión. Intenta de nuevo.");
      console.error(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
  }));

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl">Tu primer paquete</CardTitle>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
          Crea un paquete para agrupar tus primeros conceptos. Puedes crear más
          paquetes luego.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {packageCreated && (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <AlertDescription className="text-green-900 dark:text-green-100">
              ✓ Paquete creado correctamente. Completa el onboarding para empezar.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Título del paquete *
          </label>
          <Input
            placeholder="ej: Procesos de Selección y Onboarding"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={isSubmitting || packageCreated}
          />
          <p className="text-xs text-slate-500">
            Describe en general el dominio que cubrirá tu paquete.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Slug (identificador único) *
          </label>
          <Input
            placeholder="procesos-seleccion-onboarding"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={isSubmitting || packageCreated}
            className="font-mono text-sm"
          />
          <p className="text-xs text-slate-500">
            Minúsculas, números y guiones. Generado automáticamente desde el título.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Descripción
          </label>
          <Textarea
            placeholder="Descripción breve del contenido y objetivo del paquete..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting || packageCreated}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-slate-500">
            {description.length}/500 caracteres
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sistemas que cubre (HOCFLIT) *
          </label>
          <div className="grid grid-cols-2 gap-3">
            {HOCFLIT_SYSTEMS.map((system) => (
              <label
                key={system.value}
                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Checkbox
                  checked={systems.includes(system.value)}
                  onCheckedChange={() => toggleSystem(system.value)}
                  disabled={isSubmitting || packageCreated}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {system.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Próximo paso:</strong> Una vez completado el onboarding,
            accederás a la biblioteca de fuentes y podrás crear tus primeros
            conceptos.
          </p>
        </div>
      </CardContent>
    </>
  );
});

export default StepPackage;
