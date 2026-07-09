// lib/partners/templates.ts
// KL3-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §4 P-KL3): plantillas
// estáticas del editor guiado — una por cada uno de los 7 `ConceptType` (contracts/src/okf.ts,
// espejo local en `lib/kdb/schemas.ts::ConceptTypeSchema`). Cada plantilla trae:
//  - frontmatter esqueleto: `type` preseteado, `tags:[<sistema elegido>]`, `confidence:'draft'`,
//    `pii:'clean'`, `altitude` por default razonable del tipo, `sources:[]`, `curator` vacío
//    (legal_name/responsible en blanco — el curator los completa antes de poder guardar vía
//    `partner-draft-update`, que exige curator completo; mismo patrón que
//    `partner-ingest.ts`, que tampoco incluye curator en el draft recién creado).
//  - body con secciones sugeridas y 2-3 preguntas guía por sección (en español, como
//    comentarios HTML `<!-- -->` — no se renderizan, orientan al aliado sin ensuciar el texto
//    final) más una sección `# Citations` (convención spec §8 / KL3-W3, picker de fuentes).
//
// El frontmatter se serializa a mano (líneas fijas por plantilla) en vez de con un
// serializador YAML genérico: no hay dependencia YAML en el panel (a diferencia del
// compiler, que sí usa gray-matter/js-yaml) y no se quiere introducir una nueva solo para
// esto — mismo principio que `lib/knowledge-ops/parse-frontmatter.ts` (K7-W2: "parseo simple,
// sin dependencia nueva").
//
// `setFrontmatterSystem`/`setFrontmatterAltitude` hacen la actualización QUIRÚRGICA que pide
// la WU ("parseo client-side simple, sin dependencia nueva — string manipulation sobre el
// bloque ---"): operan solo sobre la línea `tags: [...]` o `altitude: N` dentro del bloque
// delimitado por `---`, sin tocar el resto del frontmatter (en particular, sin pasar por
// `parseFrontmatter`/`serializeFrontmatter` de K7 — ese parser no entiende objetos anidados
// como `curator: {legal_name, responsible}` y los aplanaría/perdería en un roundtrip completo).

import { ConceptTypeSchema, HOCFLIT_SYSTEMS } from "@/lib/kdb/schemas";
import type { z } from "zod";

export type ConceptType = z.infer<typeof ConceptTypeSchema>;
export type HocflitSystem = (typeof HOCFLIT_SYSTEMS)[number];

export const CONCEPT_TYPES = ConceptTypeSchema.options as readonly ConceptType[];

export interface ConceptTemplate {
  type: ConceptType;
  label: string;
  /** Altitud 1-5 por default razonable del tipo (ajustable en el selector antes de guardar). */
  defaultAltitude: number;
  /** Cuerpo markdown con secciones sugeridas + preguntas guía (comentarios HTML). */
  body: string;
}

// Altitud por default: escala editorial 1 (operativo/frecuente) .. 5 (estratégico/raro,
// spec OKF). Valores razonables por tipo, no normativos — el selector del editor los deja
// ajustar antes de guardar.
export const CONCEPT_TEMPLATES: Record<ConceptType, ConceptTemplate> = {
  Insight: {
    type: "Insight",
    label: "Insight",
    defaultAltitude: 2,
    body: `# Contexto
<!-- ¿En qué situación, conversación o dato se originó este insight? -->

# Hallazgo
<!-- ¿Qué patrón u observación se descubrió? ¿Con qué evidencia cuentas? -->

# Implicaciones
<!-- ¿Qué debería cambiar o decidirse a partir de este hallazgo? -->

# Citations
`,
  },
  Perfil: {
    type: "Perfil",
    label: "Perfil",
    defaultAltitude: 3,
    body: `# Descripción
<!-- ¿A quién o a qué rol describe este perfil? -->

# Responsabilidades
<!-- ¿Qué se espera de este perfil en el día a día? -->

# Señales de alerta
<!-- ¿Qué comportamientos son señal de riesgo o de bajo desempeño en este perfil? -->

# Citations
`,
  },
  Politica: {
    type: "Politica",
    label: "Política",
    defaultAltitude: 4,
    body: `# Alcance
<!-- ¿A quién o a qué situaciones aplica esta política? -->

# Reglas
<!-- ¿Cuáles son las reglas exactas que hay que seguir? -->

# Excepciones
<!-- ¿Qué excepciones existen y quién las autoriza? -->

# Citations
`,
  },
  Proceso: {
    type: "Proceso",
    label: "Proceso",
    defaultAltitude: 3,
    body: `# Contexto
<!-- ¿Cuándo aplica este proceso? -->

# Pasos
<!-- ¿Cuáles son los pasos, en orden? -->

# Riesgos si se omite
<!-- ¿Qué riesgo se corre si se omite alguno de estos pasos? -->

# Citations
`,
  },
  Metrica: {
    type: "Metrica",
    label: "Métrica",
    defaultAltitude: 3,
    body: `# Definición
<!-- ¿Qué mide exactamente esta métrica? -->

# Fórmula
<!-- ¿Cómo se calcula? ¿De dónde salen los datos? -->

# Umbral saludable
<!-- ¿Qué valor se considera saludable? ¿Cuál es la señal de alerta? -->

# Citations
`,
  },
  Riesgo: {
    type: "Riesgo",
    label: "Riesgo",
    defaultAltitude: 4,
    body: `# Descripción del riesgo
<!-- ¿En qué consiste el riesgo? -->

# Señales tempranas
<!-- ¿Qué señales anticipan que el riesgo se está materializando? -->

# Mitigación
<!-- ¿Cómo se mitiga, evita o resuelve? -->

# Citations
`,
  },
  Fuente: {
    type: "Fuente",
    label: "Fuente",
    defaultAltitude: 2,
    body: `# Descripción
<!-- ¿Qué es esta fuente y de dónde proviene? -->

# Alcance de uso
<!-- ¿Para qué se puede usar esta fuente? ¿Para qué NO aplica? -->

# Vigencia
<!-- ¿Cada cuánto debe revisarse o actualizarse? -->

# Citations
`,
  },
};

function buildFrontmatterBlock(opts: {
  type: ConceptType;
  system: HocflitSystem;
  altitude: number;
  timestamp: string;
}): string {
  return [
    "---",
    `type: "${opts.type}"`,
    `title: ""`,
    `description: ""`,
    `tags: ["${opts.system}"]`,
    `timestamp: "${opts.timestamp}"`,
    `sources: []`,
    `confidence: "draft"`,
    `pii: "clean"`,
    `altitude: ${opts.altitude}`,
    "curator:",
    `  legal_name: ""`,
    `  responsible: ""`,
    "---",
    "",
  ].join("\n");
}

/**
 * Construye el markdown completo (frontmatter + body) de la plantilla de un tipo de concepto,
 * con `tags[0]` preseteado al sistema HOCFLIT elegido.
 */
export function buildTemplateMarkdown(type: ConceptType, system: HocflitSystem): string {
  const tpl = CONCEPT_TEMPLATES[type];
  const timestamp = new Date().toISOString();
  const frontmatter = buildFrontmatterBlock({
    type,
    system,
    altitude: tpl.defaultAltitude,
    timestamp,
  });
  return `${frontmatter}\n${tpl.body}`;
}

/**
 * Aplica `transform` solo al contenido DENTRO del primer bloque `---\n...\n---` del markdown.
 * Si no hay bloque de frontmatter reconocible, devuelve el markdown intacto (no inventa uno).
 */
function withinFrontmatterBlock(markdown: string, transform: (block: string) => string): string {
  const match = markdown.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!match) return markdown;
  const [whole, open, block, close] = match;
  const start = match.index ?? 0;
  const newBlock = transform(block);
  return markdown.slice(0, start) + open + newBlock + close + markdown.slice(start + whole.length);
}

/**
 * Reemplaza SOLO `tags[0]` (el sistema HOCFLIT) dentro de la línea `tags: [...]` del
 * frontmatter, preservando cualquier otro tag que ya exista en la posición 1+. Si no hay línea
 * `tags:` reconocible, devuelve el markdown intacto (no inventa la línea).
 */
export function setFrontmatterSystem(markdown: string, system: HocflitSystem): string {
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
    const quoted = `"${system}"`;
    if (items.length === 0) {
      items.push(quoted);
    } else {
      items[0] = quoted;
    }
    lines[idx] = `tags: [${items.join(", ")}]`;
    return lines.join("\n");
  });
}

/** Reemplaza SOLO el valor de `altitude:` dentro del frontmatter. */
export function setFrontmatterAltitude(markdown: string, altitude: number): string {
  return withinFrontmatterBlock(markdown, (block) => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex((l) => /^altitude:\s*/.test(l));
    if (idx === -1) return block;
    lines[idx] = `altitude: ${altitude}`;
    return lines.join("\n");
  });
}

/**
 * Lee `tags[0]` y `altitude` del frontmatter para precargar el selector — best-effort, sin
 * pretender ser un parser YAML completo (mismo espíritu que `parseFrontmatter` de K7).
 * Devuelve `undefined` en cada campo que no pueda leer con confianza.
 */
export function readFrontmatterHints(markdown: string): {
  system?: HocflitSystem;
  altitude?: number;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1];

  const tagsMatch = block.match(/^tags:\s*\[([^\]]*)\]\s*$/m);
  let system: HocflitSystem | undefined;
  if (tagsMatch) {
    const first = tagsMatch[1].split(",")[0]?.trim().replace(/^["']|["']$/g, "");
    if (first && (HOCFLIT_SYSTEMS as readonly string[]).includes(first)) {
      system = first as HocflitSystem;
    }
  }

  const altitudeMatch = block.match(/^altitude:\s*(\d+)\s*$/m);
  const altitude = altitudeMatch ? Number(altitudeMatch[1]) : undefined;

  return { system, altitude };
}

/**
 * KL3-W3: Inserta una cita desde la biblioteca en el markdown.
 *
 * (1) Añade `source_ref` al array `sources:` del frontmatter (sin duplicar).
 *     Si no existe la clave, la crea como `sources: ["source_ref"]`.
 * (2) Añade una línea numerada bajo la sección `# Citations` del body:
 *     `[N] {title} — {source_ref}` (N = siguiente número).
 *     Crea la sección al final si no existe.
 *
 * Si el markdown no tiene frontmatter reconocible, devuelve intacto (no inventa).
 * Si `source_ref` ya existe en `sources:`, devuelve el markdown INTACTO (spec KL3-W3:
 * un doble clic en "Citar" no duplica nada).
 */
export function insertCitation(
  markdown: string,
  opts: { source_ref: string; title: string }
): string {
  // Ref ya citada → markdown intacto (corrección de evaluación 2026-07-08: un doble clic
  // en "Citar" no debe duplicar la línea en # Citations; el spec KL3-W3 pide intacto).
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch && fmMatch[1].includes(`"${opts.source_ref}"`)) {
    return markdown;
  }

  // --- Paso 1: Añadir source_ref al array sources: del frontmatter ---
  let withSourceRef = withinFrontmatterBlock(markdown, (block) => {
    const lines = block.split(/\r?\n/);

    // Buscar la línea `sources: [...]`
    const idx = lines.findIndex((l) => /^sources:\s*\[/.test(l));
    if (idx === -1) {
      // La clave no existe — crearla. Insertarla antes de la línea de cierre del frontmatter
      // (simplemente añadir al final del bloque, el cierre se completa fuera)
      lines.push(`sources: ["${opts.source_ref}"]`);
      return lines.join("\n");
    }

    // Parsear la línea existente: extraer items
    const arrMatch = lines[idx].match(/^sources:\s*\[([^\]]*)\]\s*$/);
    if (!arrMatch) return block; // Línea malformada — no tocar

    let items = arrMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Comprobar si ya existe el source_ref
    const quoted = `"${opts.source_ref}"`;
    if (!items.includes(quoted)) {
      items.push(quoted);
    }

    lines[idx] = `sources: [${items.join(", ")}]`;
    return lines.join("\n");
  });

  // --- Paso 2: Añadir línea numerada bajo # Citations ---
  const frontmatterMatch = withSourceRef.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return withSourceRef; // Sin frontmatter reconocible

  const bodyStart = frontmatterMatch[0].length;
  const body = withSourceRef.slice(bodyStart);

  // Buscar la sección "# Citations"
  const citationsMatch = body.match(/^# Citations\r?\n/m);
  if (!citationsMatch) {
    // No existe — crearla al final del body
    const newCitationsSection = `# Citations\n[1] ${opts.title} — ${opts.source_ref}\n`;
    return withSourceRef + newCitationsSection;
  }

  // Extraer el cuerpo de la sección Citations (desde "# Citations" al siguiente heading o fin)
  const citationsStartIdx = body.indexOf(citationsMatch[0]) + citationsMatch[0].length;
  const restOfBody = body.slice(citationsStartIdx);

  // Buscar el siguiente heading de nivel 1 o 2 (^## o ^#[^#])
  const nextHeadingMatch = restOfBody.match(/^##? /m);
  let citationsEndIdx = citationsStartIdx + restOfBody.length;
  if (nextHeadingMatch) {
    citationsEndIdx = citationsStartIdx + (nextHeadingMatch.index ?? 0);
  }

  // Extraer el contenido actual de la sección
  const citationsContent = withSourceRef.slice(
    frontmatterMatch[0].length + citationsMatch[0].length,
    citationsEndIdx
  );

  // Contar las líneas de cita existentes ([1], [2], etc.)
  const existingCitations = (citationsContent.match(/^\[\d+\]/gm) ?? []).length;
  const nextNumber = existingCitations + 1;

  // Insertar la nueva línea
  const newCitationLine = `[${nextNumber}] ${opts.title} — ${opts.source_ref}\n`;
  const beforeCitations = withSourceRef.slice(0, frontmatterMatch[0].length + citationsMatch[0].length);
  const afterCitations = withSourceRef.slice(citationsEndIdx);

  return beforeCitations + newCitationLine + citationsContent + afterCitations;
}
