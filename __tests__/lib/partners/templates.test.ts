// __tests__/lib/partners/templates.test.ts
// KL3-W1: tests unitarios de las plantillas del editor guiado (lib/partners/templates.ts).
//
// Scope pedido por la WU: "unit de templates (las 7 existen, frontmatter parseable,
// tags[0] se inyecta)". Se usa el parser simple ya existente en el repo
// (lib/knowledge-ops/parse-frontmatter.ts, K7-W2) para verificar "parseable" — no se
// introduce ninguna dependencia YAML nueva.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  CONCEPT_TYPES,
  CONCEPT_TEMPLATES,
  buildTemplateMarkdown,
  setFrontmatterSystem,
  setFrontmatterAltitude,
  readFrontmatterHints,
  insertCitation,
} from "../../../lib/partners/templates";
import { parseFrontmatter } from "../../../lib/knowledge-ops/parse-frontmatter";

const ALL_TYPES = [
  "Insight",
  "Perfil",
  "Politica",
  "Proceso",
  "Metrica",
  "Riesgo",
  "Fuente",
] as const;

describe("CONCEPT_TEMPLATES", () => {
  it("existen exactamente los 7 ConceptType de contracts/src/okf.ts", () => {
    assert.deepStrictEqual([...CONCEPT_TYPES].sort(), [...ALL_TYPES].sort());
    for (const type of ALL_TYPES) {
      assert.ok(CONCEPT_TEMPLATES[type], `falta plantilla para ${type}`);
    }
  });

  it("cada plantilla trae al menos 2 preguntas guía (comentarios) y sección Citations", () => {
    for (const type of ALL_TYPES) {
      const body = CONCEPT_TEMPLATES[type].body;
      const questionCount = (body.match(/<!--.*\?.*-->/g) ?? []).length;
      assert.ok(questionCount >= 2, `${type}: se esperaban >= 2 preguntas guía, hubo ${questionCount}`);
      assert.match(body, /^# Citations/m, `${type}: falta la sección "# Citations"`);
    }
  });
});

describe("buildTemplateMarkdown", () => {
  it("produce frontmatter parseable para los 7 tipos", () => {
    for (const type of ALL_TYPES) {
      const markdown = buildTemplateMarkdown(type, "l-legal");
      const parsed = parseFrontmatter(markdown);
      assert.strictEqual(parsed.ok, true, `${type}: frontmatter no parseable`);
    }
  });

  it("tags[0] se inyecta con el sistema elegido", () => {
    const markdown = buildTemplateMarkdown("Proceso", "f-finanzas");
    const parsed = parseFrontmatter(markdown);
    assert.strictEqual(parsed.ok, true);
    if (parsed.ok) {
      assert.strictEqual(parsed.data.frontmatter.type, "Proceso");
      assert.deepStrictEqual(parsed.data.frontmatter.tags, ["f-finanzas"]);
      assert.strictEqual(parsed.data.frontmatter.altitude, CONCEPT_TEMPLATES.Proceso.defaultAltitude);
      assert.strictEqual(parsed.data.frontmatter.confidence, "draft");
      assert.strictEqual(parsed.data.frontmatter.pii, "clean");
    }
  });
});

describe("setFrontmatterSystem / setFrontmatterAltitude", () => {
  it("cambia solo tags[0], preserva tags adicionales", () => {
    const markdown = buildTemplateMarkdown("Insight", "l-legal");
    const withExtraTag = markdown.replace('tags: ["l-legal"]', 'tags: ["l-legal", "contratos"]');
    const updated = setFrontmatterSystem(withExtraTag, "o-operaciones");
    const parsed = parseFrontmatter(updated);
    assert.strictEqual(parsed.ok, true);
    if (parsed.ok) {
      assert.deepStrictEqual(parsed.data.frontmatter.tags, ["o-operaciones", "contratos"]);
    }
  });

  it("cambia solo altitude, sin tocar otros campos", () => {
    const markdown = buildTemplateMarkdown("Metrica", "c-comercial");
    const updated = setFrontmatterAltitude(markdown, 5);
    const parsed = parseFrontmatter(updated);
    assert.strictEqual(parsed.ok, true);
    if (parsed.ok) {
      assert.strictEqual(parsed.data.frontmatter.altitude, 5);
      assert.strictEqual(parsed.data.frontmatter.type, "Metrica");
    }
  });

  it("no revienta ni inventa campos si el markdown no tiene frontmatter", () => {
    const plain = "# Solo un título\n\nsin frontmatter";
    assert.strictEqual(setFrontmatterSystem(plain, "l-legal"), plain);
    assert.strictEqual(setFrontmatterAltitude(plain, 4), plain);
  });
});

describe("readFrontmatterHints", () => {
  it("lee system y altitude de un draft existente", () => {
    const markdown = buildTemplateMarkdown("Riesgo", "t-tecnologia");
    const hints = readFrontmatterHints(markdown);
    assert.strictEqual(hints.system, "t-tecnologia");
    assert.strictEqual(hints.altitude, CONCEPT_TEMPLATES.Riesgo.defaultAltitude);
  });
});

describe("insertCitation", () => {
  it("añade source_ref a sources[] en el frontmatter y línea numerada bajo # Citations", () => {
    const markdown = buildTemplateMarkdown("Insight", "l-legal");
    const result = insertCitation(markdown, {
      source_ref: "url:https://example.com",
      title: "Artículo de referencia",
    });

    // Verificar que el source_ref está en el frontmatter
    const frontmatterMatch = result.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatterMatch);
    assert.match(frontmatterMatch[1], /sources:\s*\["url:https:\/\/example\.com"\]/);

    // Verificar que la línea de cita está en # Citations
    assert.match(result, /\[1\] Artículo de referencia — url:https:\/\/example\.com/);
  });

  it("no duplica el source_ref si ya existe en sources[]", () => {
    const markdown = buildTemplateMarkdown("Proceso", "o-operaciones");
    const withFirstCite = insertCitation(markdown, {
      source_ref: "doc:sha256:abc123",
      title: "Documentación interna",
    });

    const withSecondCite = insertCitation(withFirstCite, {
      source_ref: "doc:sha256:abc123",
      title: "Documentación interna",
    });

    // Contar ocurrencias de "doc:sha256:abc123" en el frontmatter
    const frontmatterMatch = withSecondCite.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const docRefCount = (frontmatterMatch?.[1] || "").match(/doc:sha256:abc123/g)?.length ?? 0;

    // Debe aparecer una sola vez en sources[] (quirúrgicamente)
    assert.strictEqual(docRefCount, 1, "source_ref debe aparecer una vez en el frontmatter");

    // Pero SÍ añade una línea numerada nueva en # Citations
    const citationCount = (withSecondCite.match(/\[1\]/g) ?? []).length;
    assert.strictEqual(citationCount, 1, "debe haber [1]");
    const citationCount2 = (withSecondCite.match(/\[2\]/g) ?? []).length;
    assert.strictEqual(citationCount2, 1, "debe haber [2]");
  });

  it("crea la sección # Citations si no existe", () => {
    const markdown = buildTemplateMarkdown("Metrica", "f-finanzas");
    // Remover manualmente la sección Citations de la plantilla
    const withoutCitations = markdown.replace(/^# Citations\s*$/m, "");
    assert.ok(!withoutCitations.match(/^# Citations/m));

    const result = insertCitation(withoutCitations, {
      source_ref: "url:https://data.example.com",
      title: "Base de datos",
    });

    // Debe haber creado la sección al final
    assert.match(result, /^# Citations\s*\[1\] Base de datos — url:https:\/\/data\.example\.com/m);
  });

  it("incrementa la numeración de las citas correctamente con 2 citas", () => {
    let markdown = buildTemplateMarkdown("Riesgo", "l-legal");

    // Insertar primera cita
    markdown = insertCitation(markdown, {
      source_ref: "url:https://ejemplo1.com",
      title: "Primera fuente",
    });

    // Insertar segunda cita
    markdown = insertCitation(markdown, {
      source_ref: "url:https://ejemplo2.com",
      title: "Segunda fuente",
    });

    // Verificar numeración
    assert.match(markdown, /\[1\] Primera fuente — url:https:\/\/ejemplo1\.com/);
    assert.match(markdown, /\[2\] Segunda fuente — url:https:\/\/ejemplo2\.com/);

    // Verificar que ambas están en sources[]
    const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatterMatch);
    assert.match(frontmatterMatch[1], /url:https:\/\/ejemplo1\.com/);
    assert.match(frontmatterMatch[1], /url:https:\/\/ejemplo2\.com/);
  });

  it("devuelve markdown intacto si no hay frontmatter reconocible", () => {
    const plain = "# Solo un título\n\nsin frontmatter";
    const result = insertCitation(plain, {
      source_ref: "url:https://example.com",
      title: "Referencia",
    });
    assert.strictEqual(result, plain);
  });

  it("crea sources: [] si no existe la clave en el frontmatter", () => {
    // Construir un markdown con frontmatter pero SIN la línea sources:
    const markdown = `---
type: "Insight"
title: "Mi insight"
tags: ["l-legal"]
---

# Contexto
Mi contenido.

# Citations
`;

    const result = insertCitation(markdown, {
      source_ref: "url:https://example.com",
      title: "Nueva fuente",
    });

    // Debe haber creado la línea sources:
    assert.match(result, /sources:\s*\["url:https:\/\/example\.com"\]/);
  });
});
