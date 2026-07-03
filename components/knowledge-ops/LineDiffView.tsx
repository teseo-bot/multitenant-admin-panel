// components/knowledge-ops/LineDiffView.tsx
// UXUI P2: "Vista diff: si action=update, diff lado-a-lado del archivo vivo vs
// new_content (usar el componente de diff que ya exista en el panel; si no existe,
// render de dos columnas <pre> con líneas añadidas/eliminadas resaltadas por una util
// simple de diff por línea — no instalar librería)."
// No existe componente de diff en el panel (grep de "diff" en package.json → 0).
// Usa lib/knowledge-ops/line-diff.ts (LCS casero) y renderiza dos columnas <pre>.

"use client";

import { computeLineDiff } from "@/lib/knowledge-ops/line-diff";
import { cn } from "@/lib/utils";

export interface LineDiffViewProps {
  oldText: string;
  newText: string;
}

export function LineDiffView({ oldText, newText }: LineDiffViewProps) {
  const { lines, addedCount, removedCount } = computeLineDiff(oldText, newText);

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Diff lado a lado">
      <div className="text-xs text-muted-foreground">
        <span className="text-green-700 dark:text-green-400">+{addedCount}</span>{" "}
        <span className="text-red-700 dark:text-red-400">-{removedCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-x-auto rounded-md border font-mono text-xs">
        <div className="border-r">
          <div className="sticky top-0 border-b bg-muted px-2 py-1 font-sans font-medium">
            Archivo vivo
          </div>
          <pre className="whitespace-pre-wrap px-2 py-1">
            {lines.map((line, idx) => {
              if (line.kind === "added") return null;
              return (
                <div
                  key={idx}
                  tabIndex={0}
                  className={cn(
                    "flex gap-2 focus-visible:outline focus-visible:outline-ring",
                    line.kind === "removed" && "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-300"
                  )}
                >
                  <span className="w-8 shrink-0 select-none text-right text-muted-foreground">
                    {line.oldLineNumber ?? ""}
                  </span>
                  <span>{line.text || " "}</span>
                </div>
              );
            })}
          </pre>
        </div>
        <div>
          <div className="sticky top-0 border-b bg-muted px-2 py-1 font-sans font-medium">
            Propuesto
          </div>
          <pre className="whitespace-pre-wrap px-2 py-1">
            {lines.map((line, idx) => {
              if (line.kind === "removed") return null;
              return (
                <div
                  key={idx}
                  tabIndex={0}
                  className={cn(
                    "flex gap-2 focus-visible:outline focus-visible:outline-ring",
                    line.kind === "added" && "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-300"
                  )}
                >
                  <span className="w-8 shrink-0 select-none text-right text-muted-foreground">
                    {line.newLineNumber ?? ""}
                  </span>
                  <span>{line.text || " "}</span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}
