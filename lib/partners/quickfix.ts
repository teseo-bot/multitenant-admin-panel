// lib/partners/quickfix.ts
// KL4-W1: espejo CLIENT-SIDE de los 4 quick-fixes deterministas del compiler
// (src/partners/validator.ts applyQuickFix — mantener sincronizado).
//
// Operando con la misma cirugía de strings que templates.ts (sin parser YAML nuevo).
// Solo conoce los 4 fixes deterministas:
//   - n2-title: generar título desde filename
//   - n2-tags-sistema: mover sistema HOCFLIT a tags[0]
//   - n2-timestamp: normalizar timestamp a ISO 8601
//   - n2-link-relativo: convertir link relativo a bundle-relativo
//
// Cualquier otro rule_id devuelve el markdown intacto (unknown fix → silent pass-through).

import type { ValidationFinding } from "@/lib/partners/compiler-client";

function titleFromFilename(filePath: string): string {
  const base = (filePath.split("/").pop() ?? filePath).replace(/\.md$/i, "");
  const words = base.split(/[-_]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function withinFrontmatterBlock(
  markdown: string,
  transform: (block: string) => string
): string {
  const match = markdown.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!match) return markdown;
  const [whole, open, block, close] = match;
  const start = match.index ?? 0;
  const newBlock = transform(block);
  return (
    markdown.slice(0, start) +
    open +
    newBlock +
    close +
    markdown.slice(start + whole.length)
  );
}

function fixTitleFromFilename(
  markdown: string,
  finding: ValidationFinding,
  filename?: string
): string {
  if (!finding.fix?.value) return markdown;
  if (!filename) return markdown; // necesitamos el filename para derivar el título
  const fixValue = finding.fix.value;
  return withinFrontmatterBlock(markdown, (block) => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex((l) => /^title:\s*/.test(l));

    if (idx === -1) {
      // No hay línea title → insertarla después de type (línea 0 debería ser type:)
      const typeIdx = lines.findIndex((l) => /^type:\s*/.test(l));
      if (typeIdx === -1) return block; // no hay type, abortar
      lines.splice(typeIdx + 1, 0, `title: "${fixValue}"`);
    } else {
      // Línea title existe → actualizar (idempotencia: si ya tiene el valor, no cambiar)
      if (lines[idx].includes(`"${fixValue}"`)) return block;
      lines[idx] = `title: "${fixValue}"`;
    }

    return lines.join("\n");
  });
}

function fixTagsSistema(markdown: string, finding: ValidationFinding): string {
  if (!finding.fix?.value) return markdown;
  const fixValue = finding.fix.value;
  return withinFrontmatterBlock(markdown, (block) => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex((l) => /^tags:\s*\[/.test(l));
    if (idx === -1) return block;

    const arrMatch = lines[idx].match(/^tags:\s*\[([^\]]*)\]\s*$/);
    if (!arrMatch) return block;

    const items = arrMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // idempotencia: si ya es el primer elemento, no cambiar
    const quoted = `"${fixValue}"`;
    if (items.length > 0 && items[0] === quoted) return block;

    const idx_val = items.indexOf(quoted);
    if (idx_val === -1) return block; // sistema no encontrado

    // mover a posición 0
    items.splice(idx_val, 1);
    items.unshift(quoted);

    lines[idx] = `tags: [${items.join(", ")}]`;
    return lines.join("\n");
  });
}

function fixTimestamp(markdown: string, finding: ValidationFinding): string {
  if (!finding.fix?.value) return markdown;
  const fixValue = finding.fix.value;
  return withinFrontmatterBlock(markdown, (block) => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex((l) => /^timestamp:\s*/.test(l));
    if (idx === -1) return block;

    // idempotencia: si ya tiene el valor esperado, no cambiar nada
    if (lines[idx].includes(`"${fixValue}"`)) return block;

    lines[idx] = `timestamp: "${fixValue}"`;
    return lines.join("\n");
  });
}

function fixRelativeLink(markdown: string, finding: ValidationFinding): string {
  if (!finding.fix || finding.fix.from === undefined || finding.fix.to === undefined)
    return markdown;

  const from = finding.fix.from;
  const to = finding.fix.to;
  const pattern = `](${from})`;
  const replacement = `](${to})`;

  // idempotencia: si ya está aplicado, no cambiar nada
  if (!markdown.includes(pattern)) return markdown;

  return markdown.replace(pattern, replacement);
}

/**
 * Aplica UNA reparación determinista de `finding.fix` sobre `markdown`.
 * Solo conoce las 4 reparaciones deterministas del validador del compiler.
 * Cada función interna es idempotente por construcción.
 *
 * Si el finding no tiene `fix` o el `rule_id` no es conocido, devuelve el markdown intacto.
 *
 * @param markdown El markdown a reparar
 * @param finding El ValidationFinding que contiene el fix
 * @param filename Opcional, necesario para n2-title (derivar título desde nombre de archivo)
 */
export function applyQuickFixLocal(
  markdown: string,
  finding: ValidationFinding,
  filename?: string
): string {
  if (!finding.fix) return markdown;

  switch (finding.rule_id) {
    case "n2-title":
      return fixTitleFromFilename(markdown, finding, filename);
    case "n2-tags-sistema":
      return fixTagsSistema(markdown, finding);
    case "n2-timestamp":
      return fixTimestamp(markdown, finding);
    case "n2-link-relativo":
      return fixRelativeLink(markdown, finding);
    default:
      return markdown;
  }
}
