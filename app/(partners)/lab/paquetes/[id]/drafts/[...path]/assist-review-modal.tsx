// app/(partners)/lab/paquetes/[id]/drafts/[...path]/assist-review-modal.tsx
// KL4-W2: modal de revisión de la propuesta del asistente IA.
//
// Muestra antes/después usando la librería `diff` (lado a lado con scroll horizontal),
// aviso ámbar si hay stripped_refs, y advertencia informativa de errores en la propuesta.
// Botones: Aceptar (escribe al textarea, no guarda), Descartar (sin efectos).

"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { diffLines } from "diff";
import type { PartnerAssistResult, ValidationReport } from "@/lib/partners/compiler-client";

interface AssistReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalMarkdown: string;
  assistResult: PartnerAssistResult | null;
  loading?: boolean;
  onAccept: (markdown: string) => void;
  onDiscard: () => void;
}

export function AssistReviewModal({
  open,
  onOpenChange,
  originalMarkdown,
  assistResult,
  loading = false,
  onAccept,
  onDiscard,
}: AssistReviewModalProps) {
  // Los hooks van SIEMPRE arriba de cualquier return temprano (rules-of-hooks):
  // se llaman incondicionalmente y en el mismo orden en cada render. El caso
  // `assistResult === null` se maneja dentro del memo y con el return de abajo.

  // Computar diff entre original y propuesta
  const diffLines_ = useMemo(() => {
    if (!assistResult) return [];
    return diffLines(originalMarkdown, assistResult.markdown);
  }, [originalMarkdown, assistResult]);

  // Contar errores en el report de la propuesta
  const errorCount = useMemo(() => {
    if (!assistResult) return 0;
    return assistResult.report.findings.filter((f) => f.severity === "error").length;
  }, [assistResult]);

  if (!assistResult) return null;

  const handleAccept = () => {
    onAccept(assistResult.markdown);
    onOpenChange(false);
  };

  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar propuesta del asistente</DialogTitle>
          <DialogDescription>
            Compara el contenido original con la propuesta. Puedes aceptar o descartar los cambios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Diff side-by-side con scroll */}
          <div className="flex-1 overflow-auto border rounded-md">
            <div className="grid grid-cols-2 divide-x font-mono text-xs min-w-min">
              {/* Columna izquierda: original */}
              <div className="p-3 bg-muted/30">
                <div className="mb-2 font-semibold text-muted-foreground sticky top-0 bg-muted/30">
                  Original
                </div>
                <div className="space-y-0">
                  {diffLines_.map((line, idx) => {
                    if (line.added) return null;
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 whitespace-pre-wrap break-all ${
                          line.removed ? "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-200" : ""
                        }`}
                      >
                        {line.value}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Columna derecha: propuesta */}
              <div className="p-3 bg-muted/20">
                <div className="mb-2 font-semibold text-muted-foreground sticky top-0 bg-muted/20">
                  Propuesta
                </div>
                <div className="space-y-0">
                  {diffLines_.map((line, idx) => {
                    if (line.removed) return null;
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 whitespace-pre-wrap break-all ${
                          line.added ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-200" : ""
                        }`}
                      >
                        {line.value}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Avisos */}
          <div className="space-y-2">
            {/* Aviso stripped_refs */}
            {assistResult.stripped_refs.length > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900/30 dark:bg-yellow-900/10">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-900 dark:text-yellow-200">
                    Citas descartadas
                  </p>
                  <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                    El asistente intentó citar fuentes no registradas. Se eliminaron: {" "}
                    <code className="bg-white dark:bg-gray-900 px-1 rounded text-xs">
                      {assistResult.stripped_refs.join(", ")}
                    </code>
                  </p>
                </div>
              </div>
            )}

            {/* Advertencia de errores en la propuesta */}
            {errorCount > 0 && (
              <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/30 dark:bg-blue-900/10">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    La propuesta aún tiene problemas de estructura
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                    {errorCount} error{errorCount > 1 ? "es" : ""} pendiente{errorCount > 1 ? "s" : ""} de resolver
                    (puedes aceptar y seguir editando; el validador te ayudará).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDiscard} disabled={loading}>
            Descartar
          </Button>
          <Button onClick={handleAccept} disabled={loading}>
            {loading ? "Aceptando…" : "Aceptar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
