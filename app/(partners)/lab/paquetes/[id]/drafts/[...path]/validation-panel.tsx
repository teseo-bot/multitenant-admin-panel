// app/(partners)/lab/paquetes/[id]/drafts/[...path]/validation-panel.tsx
// KL4-W1: panel validador en vivo del editor (lado derecho P-KL3).
//
// Al abrir, al guardar y con botón "Validar ahora": llama la ruta de validación.
// Render: resumen por nivel (N1/N2/N3 con conteo y check verde si 0 errores), lista de
// findings ordenada errores primero (icono por severity, message_es, línea si viene), y para
// findings con `fix`: botón "Corregir" que aplica applyQuickFixLocal SOBRE EL TEXTAREA
// (estado local — NO guarda).

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle, Loader } from "lucide-react";
import { applyQuickFixLocal } from "@/lib/partners/quickfix";
import type {
  ValidationReport,
  ValidationFinding,
} from "@/lib/partners/compiler-client";

interface ValidationPanelProps {
  draftPath: string;
  packageId: string;
  markdown: string;
  onMarkdownChange: (markdown: string) => void;
  savedAt?: number; // timestamp para detectar cambios tras guardar
}

export function ValidationPanel({
  draftPath,
  packageId,
  markdown,
  onMarkdownChange,
  savedAt,
}: ValidationPanelProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validar al abrir y al guardar
  useEffect(() => {
    validateNow();
  }, [savedAt]); // Reevaluar tras guardar

  async function validateNow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/partners/me/drafts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_path: draftPath,
          markdown,
          package_id: packageId,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `Error ${res.status}`);
        return;
      }

      setReport(body as ValidationReport);
    } catch (err) {
      setError("No se pudo validar — el editor sigue funcionando");
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFix(finding: ValidationFinding) {
    const fixed = applyQuickFixLocal(markdown, finding, draftPath);
    if (fixed !== markdown) {
      onMarkdownChange(fixed);
      // Re-validar después de aplicar el fix
      setTimeout(() => validateNow(), 100);
    }
  }

  if (error && !report) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border-l border-dashed p-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <p className="font-medium text-xs">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={validateNow}
          disabled={loading}
        >
          {loading ? "Validando…" : "Reintentar"}
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 border-l border-dashed p-4 text-sm text-muted-foreground">
        {loading && <Loader className="h-5 w-5 animate-spin" />}
        <p className="font-medium">{loading ? "Validando…" : "Validación"}</p>
      </div>
    );
  }

  const findingsByLevel = {
    n1: report.findings.filter((f) => f.level === "n1"),
    n2: report.findings.filter((f) => f.level === "n2"),
    n3: report.findings.filter((f) => f.level === "n3"),
  };

  const errorsByLevel = {
    n1: findingsByLevel.n1.filter((f) => f.severity === "error").length,
    n2: findingsByLevel.n2.filter((f) => f.severity === "error").length,
    n3: findingsByLevel.n3.filter((f) => f.severity === "error").length,
  };

  // Ordenar findings: errores primero, luego por nivel
  const sortedFindings = [...report.findings].sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "error" ? -1 : 1;
    }
    const levelOrder = { n1: 0, n2: 1, n3: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  return (
    <div className="flex flex-col gap-4 border-l border-dashed p-4 overflow-y-auto">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Validación</p>
          <Button
            variant="outline"
            size="xs"
            onClick={validateNow}
            disabled={loading}
          >
            {loading ? "…" : "Validar ahora"}
          </Button>
        </div>

        {/* Resumen por nivel */}
        <div className="space-y-1">
          {["n1", "n2", "n3"].map((level) => {
            const count = findingsByLevel[level as "n1" | "n2" | "n3"].length;
            const errors = errorsByLevel[level as "n1" | "n2" | "n3"];
            const hasErrors = errors > 0;
            return (
              <div key={level} className="flex items-center gap-2 text-xs">
                {hasErrors ? (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  {level.toUpperCase()}: {count}
                </span>
                {hasErrors && (
                  <Badge variant="destructive" className="ml-auto text-xs px-1">
                    {errors} error{errors > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de findings */}
      {sortedFindings.length > 0 && (
        <div className="border-t pt-2">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {sortedFindings.map((finding, idx) => (
              <div
                key={idx}
                className="border rounded-md p-2 bg-muted/30 text-xs space-y-1"
              >
                <div className="flex items-start gap-2">
                  {finding.severity === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {finding.message_es}
                    </p>
                    {finding.line && (
                      <p className="text-muted-foreground">Línea {finding.line}</p>
                    )}
                  </div>
                </div>

                {/* Botón de fix si disponible */}
                {finding.fix && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-muted-foreground text-xs italic">
                      {finding.fix.description_es}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleApplyFix(finding)}
                      className="ml-auto h-6 px-2 text-xs"
                    >
                      Corregir
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedFindings.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <p className="text-xs font-medium">Sin issues</p>
        </div>
      )}
    </div>
  );
}
