// lib/knowledge-ops/parse-frontmatter.ts
// K7-W2: parseo simple de frontmatter YAML del contenido editado en el editor de
// corrección de P2 (UXUI: "parsea el frontmatter con una util simple de split '---'").
// NO es un parser YAML completo — cubre el subconjunto usado en TRD §3 (escalares,
// arrays inline `[a, b]`). Suficiente para validar con ConceptFrontmatterSchema antes
// de habilitar "Aprobar con correcciones".

export interface ParsedContent {
  frontmatter: Record<string, unknown>;
  body: string;
}

export type ParseFrontmatterResult =
  | { ok: true; data: ParsedContent }
  | { ok: false; error: string };

/**
 * Divide un archivo de concepto `---\n<frontmatter>\n---\n<body>` en frontmatter
 * (objeto plano parseado) y body (markdown). Soporta escalares (`clave: valor`) y
 * arrays inline (`clave: [a, b, c]`); los valores numéricos y booleanos se castean.
 */
export function parseFrontmatter(content: string): ParseFrontmatterResult {
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, error: "Contenido vacío" };
  }

  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { ok: false, error: "El contenido debe iniciar con delimitador '---' de frontmatter" };
  }

  const withoutOpening = normalized.slice(4); // corta "---\n"
  const closingIdx = withoutOpening.indexOf("\n---\n");
  if (closingIdx === -1) {
    return { ok: false, error: "No se encontró el delimitador de cierre '---' del frontmatter" };
  }

  const rawFrontmatter = withoutOpening.slice(0, closingIdx);
  const body = withoutOpening.slice(closingIdx + 5); // salta "\n---\n"

  const frontmatter: Record<string, unknown> = {};
  const lines = rawFrontmatter.split("\n");
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let rawValue = match[2].trim();

    // Quitar comillas envolventes
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      rawValue = rawValue.slice(1, -1);
    }

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const inner = rawValue.slice(1, -1).trim();
      frontmatter[key] = inner === ""
        ? []
        : inner.split(",").map((item) => {
            const trimmed = item.trim();
            return trimmed.startsWith('"') || trimmed.startsWith("'")
              ? trimmed.slice(1, -1)
              : trimmed;
          });
      continue;
    }

    if (rawValue === "true") {
      frontmatter[key] = true;
    } else if (rawValue === "false") {
      frontmatter[key] = false;
    } else if (rawValue !== "" && !Number.isNaN(Number(rawValue)) && /^-?\d+(\.\d+)?$/.test(rawValue)) {
      frontmatter[key] = Number(rawValue);
    } else {
      frontmatter[key] = rawValue;
    }
  }

  return { ok: true, data: { frontmatter, body: body.replace(/^\n/, "") } };
}

/**
 * Serializa un objeto frontmatter plano de vuelta a bloque `---\n...\n---\n` + body.
 * Usado para reconstruir el "archivo completo" del concepto vivo (que la API devuelve
 * como {frontmatter, body} separados) y así poder compararlo contra `new_content`
 * (que sí es el archivo completo) en el diff de P2.
 */
export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return `${lines.join("\n")}\n${body}`;
}
