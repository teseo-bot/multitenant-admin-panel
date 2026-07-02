// __tests__/lib/knowledge-ops/parse-frontmatter.test.ts
// K7-W2: tests unitarios de lib/knowledge-ops/parse-frontmatter.ts (parseo simple del
// frontmatter editado en P2) + su combinación con ConceptFrontmatterSchema de
// lib/kdb/schemas.ts (validación inline antes de "Aprobar con correcciones").
// Ver nota de fallback de tests en line-diff.test.ts (mismo motivo: no hay patrón e2e
// mockeable en el panel para /api/kdb/*).

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseFrontmatter, serializeFrontmatter } from "../../../lib/knowledge-ops/parse-frontmatter";
import { ConceptFrontmatterSchema } from "../../../lib/kdb/schemas";

const VALID_CONTENT = `---
type: Insight
title: Objeciones de precio sector salud
description: Resumen de objeciones frecuentes
tags: [c-comercial, precio]
timestamp: 2026-07-01T10:00:00.000Z
sources: [conv:thread-123]
confidence: draft
pii: clean
altitude: 2
---

Cuerpo del concepto con [link interno](/c-comercial/otro.md).
`;

describe("parseFrontmatter", () => {
  it("parsea correctamente un concepto válido con array inline", () => {
    const result = parseFrontmatter(VALID_CONTENT);
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.data.frontmatter.type, "Insight");
    assert.strictEqual(result.data.frontmatter.altitude, 2);
    assert.deepStrictEqual(result.data.frontmatter.tags, ["c-comercial", "precio"]);
    assert.deepStrictEqual(result.data.frontmatter.sources, ["conv:thread-123"]);
    assert.ok(result.data.body.includes("Cuerpo del concepto"));
  });

  it("rechaza contenido sin delimitador de apertura '---'", () => {
    const result = parseFrontmatter("type: Insight\ntitle: X");
    assert.strictEqual(result.ok, false);
  });

  it("rechaza contenido vacío", () => {
    const result = parseFrontmatter("");
    assert.strictEqual(result.ok, false);
  });

  it("rechaza contenido sin delimitador de cierre", () => {
    const result = parseFrontmatter("---\ntype: Insight\ntitle: X\n\nBody sin cierre");
    assert.strictEqual(result.ok, false);
  });

  it("castea booleanos y numéricos correctamente", () => {
    const content = `---\naltitude: 4\nactive: true\ntitle: X\n---\nBody\n`;
    const result = parseFrontmatter(content);
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    assert.strictEqual(result.data.frontmatter.altitude, 4);
    assert.strictEqual(result.data.frontmatter.active, true);
  });
});

describe("parseFrontmatter + ConceptFrontmatterSchema (validación inline P2)", () => {
  it("frontmatter válido pasa ConceptFrontmatterSchema", () => {
    const parsed = parseFrontmatter(VALID_CONTENT);
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    assert.strictEqual(zodResult.success, true);
  });

  it("frontmatter sin pii falla ConceptFrontmatterSchema (obligatorio, TRD §3)", () => {
    const content = `---
type: Insight
title: X
description: Y
tags: [c-comercial]
timestamp: 2026-07-01T10:00:00.000Z
sources: [conv:thread-123]
confidence: draft
altitude: 2
---
Body
`;
    const parsed = parseFrontmatter(content);
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    assert.strictEqual(zodResult.success, false);
  });

  it("tags[0] no es slug de sistema HOCFLIT falla validación", () => {
    const content = `---
type: Insight
title: X
description: Y
tags: [tag-libre, c-comercial]
timestamp: 2026-07-01T10:00:00.000Z
sources: [conv:thread-123]
confidence: draft
pii: clean
altitude: 2
---
Body
`;
    const parsed = parseFrontmatter(content);
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    assert.strictEqual(zodResult.success, false);
  });

  it("altitude fuera de rango (1-5) falla validación", () => {
    const content = `---
type: Insight
title: X
description: Y
tags: [c-comercial]
timestamp: 2026-07-01T10:00:00.000Z
sources: [conv:thread-123]
confidence: draft
pii: clean
altitude: 9
---
Body
`;
    const parsed = parseFrontmatter(content);
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    assert.strictEqual(zodResult.success, false);
  });

  it("source-ref inválido falla validación", () => {
    const content = `---
type: Insight
title: X
description: Y
tags: [c-comercial]
timestamp: 2026-07-01T10:00:00.000Z
sources: [not-a-valid-ref]
confidence: draft
pii: clean
altitude: 2
---
Body
`;
    const parsed = parseFrontmatter(content);
    assert.strictEqual(parsed.ok, true);
    if (!parsed.ok) return;
    const zodResult = ConceptFrontmatterSchema.safeParse(parsed.data.frontmatter);
    assert.strictEqual(zodResult.success, false);
  });
});

describe("serializeFrontmatter", () => {
  it("round-trip: serializar y volver a parsear preserva campos clave", () => {
    const frontmatter = {
      type: "Insight",
      title: "X",
      tags: ["c-comercial", "precio"],
      altitude: 3,
    };
    const serialized = serializeFrontmatter(frontmatter, "Cuerpo de prueba");
    const reparsed = parseFrontmatter(serialized);
    assert.strictEqual(reparsed.ok, true);
    if (!reparsed.ok) return;
    assert.strictEqual(reparsed.data.frontmatter.type, "Insight");
    assert.strictEqual(reparsed.data.frontmatter.altitude, 3);
    assert.deepStrictEqual(reparsed.data.frontmatter.tags, ["c-comercial", "precio"]);
    assert.strictEqual(reparsed.data.body.trim(), "Cuerpo de prueba");
  });
});
