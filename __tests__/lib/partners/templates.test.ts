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
