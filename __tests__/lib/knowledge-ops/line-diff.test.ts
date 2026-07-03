// __tests__/lib/knowledge-ops/line-diff.test.ts
// K7-W2: tests unitarios de lib/knowledge-ops/line-diff.ts (diff casero por líneas de
// P2). Usa node:test (mismo motivo que __tests__/lib/kdb/review.test.ts de K7-W1:
// vitest no está instalado en node_modules/.bin pese a existir vitest.config.ts).
//
// Fallback de tests: la WU pidió e2e Playwright para "aprobar" y
// "rechazar-sin-motivo-bloqueado", pero playwright.config.ts apunta a una URL de
// producción fija (baseURL Cloud Run) sin patrón de route interception/mock de
// /api/kdb/* en ningún spec existente (grep de "page.route|context.route" en tests/ →
// 0 resultados), y no hay patrón de auth mockeable (los specs existentes solo aceptan
// como válido el redirect a /auth/login sin loguearse). Por instrucción de la WU
// ("si no existe NINGÚN patrón utilizable... entrega en su lugar tests unitarios de
// la util de diff y del parseo/validación de frontmatter"), se entregan estos tests
// unitarios en su lugar.

import { describe, it } from "node:test";
import assert from "node:assert";
import { computeLineDiff } from "../../../lib/knowledge-ops/line-diff";

describe("computeLineDiff", () => {
  it("texto idéntico: todas las líneas equal, 0 added, 0 removed", () => {
    const text = "linea1\nlinea2\nlinea3";
    const result = computeLineDiff(text, text);
    assert.strictEqual(result.addedCount, 0);
    assert.strictEqual(result.removedCount, 0);
    assert.ok(result.lines.every((l) => l.kind === "equal"));
  });

  it("línea añadida al final: 1 added, 0 removed", () => {
    const result = computeLineDiff("a\nb", "a\nb\nc");
    assert.strictEqual(result.addedCount, 1);
    assert.strictEqual(result.removedCount, 0);
    const added = result.lines.filter((l) => l.kind === "added");
    assert.strictEqual(added.length, 1);
    assert.strictEqual(added[0].text, "c");
  });

  it("línea eliminada: 0 added, 1 removed", () => {
    const result = computeLineDiff("a\nb\nc", "a\nc");
    assert.strictEqual(result.addedCount, 0);
    assert.strictEqual(result.removedCount, 1);
    const removed = result.lines.filter((l) => l.kind === "removed");
    assert.strictEqual(removed[0].text, "b");
  });

  it("línea modificada: se reporta como removed+added (no hay 'modified')", () => {
    const result = computeLineDiff("titulo: Viejo", "titulo: Nuevo");
    assert.strictEqual(result.addedCount, 1);
    assert.strictEqual(result.removedCount, 1);
  });

  it("preserva numeración de línea original y nueva por separado", () => {
    const result = computeLineDiff("a\nb\nc", "a\nX\nc");
    const removedB = result.lines.find((l) => l.kind === "removed" && l.text === "b");
    const addedX = result.lines.find((l) => l.kind === "added" && l.text === "X");
    assert.strictEqual(removedB?.oldLineNumber, 2);
    assert.strictEqual(removedB?.newLineNumber, null);
    assert.strictEqual(addedX?.newLineNumber, 2);
    assert.strictEqual(addedX?.oldLineNumber, null);
  });

  it("archivo vivo vacío (create): todo el newText se reporta added", () => {
    const result = computeLineDiff("", "linea1\nlinea2");
    // split("") produce [""] así que hay 1 línea "equal-candidata" vacía a considerar;
    // lo relevante es que el contenido real del nuevo archivo aparece como added.
    const addedTexts = result.lines.filter((l) => l.kind === "added").map((l) => l.text);
    assert.ok(addedTexts.includes("linea1"));
    assert.ok(addedTexts.includes("linea2"));
  });
});
