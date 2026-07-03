// lib/knowledge-ops/line-diff.ts
// K7-W2: diff casero por líneas para P2 (UXUI: "si no existe [componente de diff], render
// de dos columnas <pre> con líneas añadidas/eliminadas resaltadas por una util simple de
// diff por línea — no instalar librería"). Implementa LCS (longest common subsequence)
// clásico sobre líneas, O(n*m), suficiente para archivos de concepto (≤8000 chars).

export type DiffLineKind = "equal" | "added" | "removed";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Número de línea en el archivo original (1-based), o null si no aplica (added). */
  oldLineNumber: number | null;
  /** Número de línea en el archivo nuevo (1-based), o null si no aplica (removed). */
  newLineNumber: number | null;
}

export interface LineDiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
}

/**
 * Calcula un diff línea a línea entre `oldText` y `newText` usando LCS.
 * Devuelve una secuencia unificada de líneas marcadas equal/added/removed,
 * preservando el orden de aparición (apto para render lado-a-lado).
 */
export function computeLineDiff(oldText: string, newText: string): LineDiffResult {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  // Tabla LCS (n+1) x (m+1)
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      lines.push({ kind: "equal", text: oldLines[i], oldLineNumber: i + 1, newLineNumber: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ kind: "removed", text: oldLines[i], oldLineNumber: i + 1, newLineNumber: null });
      removedCount++;
      i++;
    } else {
      lines.push({ kind: "added", text: newLines[j], oldLineNumber: null, newLineNumber: j + 1 });
      addedCount++;
      j++;
    }
  }
  while (i < n) {
    lines.push({ kind: "removed", text: oldLines[i], oldLineNumber: i + 1, newLineNumber: null });
    removedCount++;
    i++;
  }
  while (j < m) {
    lines.push({ kind: "added", text: newLines[j], oldLineNumber: null, newLineNumber: j + 1 });
    addedCount++;
    j++;
  }

  return { lines, addedCount, removedCount };
}
