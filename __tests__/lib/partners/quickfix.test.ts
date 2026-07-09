// __tests__/lib/partners/quickfix.test.ts
// KL4-W1: tests del módulo applyQuickFixLocal (espejo client-side de los quick-fixes del compiler).
// Casos espejo de los del compilador + finding sin fix → intacto + idempotencia.

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQuickFixLocal } from "@/lib/partners/quickfix";
import type { ValidationFinding } from "@/lib/partners/compiler-client";

const PERFECT_CONCEPT = `---
type: Insight
title: Concepto perfecto
description: Descripción válida del concepto.
tags: ["c-comercial"]
timestamp: 2026-07-01T10:00:00Z
sources: [doc:sha256:${"2".repeat(64)}]
confidence: draft
pii: clean
altitude: 1
---

Cuerpo de prueba.
`;

const CONCEPT_WITHOUT_TITLE = `---
type: Insight
description: Concepto sin título.
tags: ["c-comercial"]
timestamp: 2026-07-01T10:00:00Z
sources: [doc:sha256:${"2".repeat(64)}]
confidence: draft
pii: clean
altitude: 1
---

Cuerpo de prueba.
`;

const TAGS_OUT_OF_ORDER = `---
type: Insight
title: Tags fuera de orden
description: El sistema HOCFLIT no es tags[0].
tags: ["otro-tag", "c-comercial"]
timestamp: 2026-07-01T10:00:00Z
sources: [doc:sha256:${"2".repeat(64)}]
confidence: draft
pii: clean
altitude: 1
---

Cuerpo de prueba.
`;

const BAD_TIMESTAMP = `---
type: Insight
title: Timestamp malo
description: Timestamp en formato incorrecto.
tags: ["c-comercial"]
timestamp: 2026-07-08
sources: [doc:sha256:${"2".repeat(64)}]
confidence: draft
pii: clean
altitude: 1
---

Cuerpo de prueba.
`;

const WITH_RELATIVE_LINK = `---
type: Insight
title: Con link relativo
description: El cuerpo tiene un link relativo.
tags: ["c-comercial"]
timestamp: 2026-07-01T10:00:00Z
sources: [doc:sha256:${"2".repeat(64)}]
confidence: draft
pii: clean
altitude: 1
---

Ver [este documento](./otro-concepto.md) para más detalles.
`;

test("n2-title: fix desde filename genera el título", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-title",
    level: "n2",
    severity: "error",
    message_es: "title es obligatorio",
    fix: {
      kind: "set_field",
      description_es: 'Generar title desde "politica-de-vacaciones.md".',
      value: "Politica De Vacaciones",
    },
  };

  const fixed = applyQuickFixLocal(
    CONCEPT_WITHOUT_TITLE,
    finding,
    "politica-de-vacaciones.md"
  );
  assert.notEqual(fixed, CONCEPT_WITHOUT_TITLE);
  assert.ok(fixed.includes('title: "Politica De Vacaciones"'));
});

test("n2-title: sin filename → markdown intacto", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-title",
    level: "n2",
    severity: "error",
    message_es: "title es obligatorio",
    fix: {
      kind: "set_field",
      description_es: "Generar title.",
      value: "Titulo",
    },
  };

  const fixed = applyQuickFixLocal(CONCEPT_WITHOUT_TITLE, finding);
  assert.equal(fixed, CONCEPT_WITHOUT_TITLE);
});

test("n2-title: idempotencia — aplicar dos veces = una sola vez", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-title",
    level: "n2",
    severity: "error",
    message_es: "title es obligatorio",
    fix: {
      kind: "set_field",
      description_es: "Generar title.",
      value: "Mi Titulo",
    },
  };

  const fixed1 = applyQuickFixLocal(
    CONCEPT_WITHOUT_TITLE,
    finding,
    "mi-titulo.md"
  );
  const fixed2 = applyQuickFixLocal(fixed1, finding, "mi-titulo.md");
  assert.equal(fixed1, fixed2);
});

test("n2-tags-sistema: mover sistema a tags[0]", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-tags-sistema",
    level: "n2",
    severity: "error",
    message_es: "tags[0] debe ser el sistema HOCFLIT",
    fix: {
      kind: "set_field",
      description_es: 'Mover "c-comercial" a tags[0].',
      value: "c-comercial",
    },
  };

  const fixed = applyQuickFixLocal(TAGS_OUT_OF_ORDER, finding);
  assert.notEqual(fixed, TAGS_OUT_OF_ORDER);
  assert.ok(fixed.includes('tags: ["c-comercial", "otro-tag"]'));
});

test("n2-tags-sistema: idempotencia — aplicar dos veces = una sola vez", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-tags-sistema",
    level: "n2",
    severity: "error",
    message_es: "tags[0] debe ser el sistema HOCFLIT",
    fix: {
      kind: "set_field",
      description_es: 'Mover "c-comercial" a tags[0].',
      value: "c-comercial",
    },
  };

  const fixed1 = applyQuickFixLocal(TAGS_OUT_OF_ORDER, finding);
  const fixed2 = applyQuickFixLocal(fixed1, finding);
  assert.equal(fixed1, fixed2);
});

test("n2-timestamp: normalizar a ISO 8601", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-timestamp",
    level: "n2",
    severity: "error",
    message_es: "timestamp debe estar en ISO 8601",
    fix: {
      kind: "set_field",
      description_es: 'Normalizar timestamp a "2026-07-08T00:00:00Z".',
      value: "2026-07-08T00:00:00Z",
    },
  };

  const fixed = applyQuickFixLocal(BAD_TIMESTAMP, finding);
  assert.notEqual(fixed, BAD_TIMESTAMP);
  assert.ok(fixed.includes('timestamp: "2026-07-08T00:00:00Z"'));
});

test("n2-timestamp: idempotencia", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-timestamp",
    level: "n2",
    severity: "error",
    message_es: "timestamp debe estar en ISO 8601",
    fix: {
      kind: "set_field",
      description_es: "Normalizar timestamp.",
      value: "2026-07-08T00:00:00Z",
    },
  };

  const fixed1 = applyQuickFixLocal(BAD_TIMESTAMP, finding);
  const fixed2 = applyQuickFixLocal(fixed1, finding);
  assert.equal(fixed1, fixed2);
});

test("n2-link-relativo: convertir a forma bundle-relativa", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-link-relativo",
    level: "n2",
    severity: "warn",
    message_es: "El link usa forma relativa",
    fix: {
      kind: "replace_text",
      description_es: 'Convertir "./otro-concepto.md" a "/otro-concepto.md".',
      from: "./otro-concepto.md",
      to: "/otro-concepto.md",
    },
  };

  const fixed = applyQuickFixLocal(WITH_RELATIVE_LINK, finding);
  assert.notEqual(fixed, WITH_RELATIVE_LINK);
  assert.ok(fixed.includes("](/otro-concepto.md)"));
  assert.ok(!fixed.includes("](./otro-concepto.md)"));
});

test("n2-link-relativo: idempotencia", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-link-relativo",
    level: "n2",
    severity: "warn",
    message_es: "El link usa forma relativa",
    fix: {
      kind: "replace_text",
      description_es: 'Convertir "./otro-concepto.md" a "/otro-concepto.md".',
      from: "./otro-concepto.md",
      to: "/otro-concepto.md",
    },
  };

  const fixed1 = applyQuickFixLocal(WITH_RELATIVE_LINK, finding);
  const fixed2 = applyQuickFixLocal(fixed1, finding);
  assert.equal(fixed1, fixed2);
});

test("finding sin fix → markdown intacto", () => {
  const finding: ValidationFinding = {
    rule_id: "n2-body-largo",
    level: "n2",
    severity: "warn",
    message_es: "El cuerpo es muy largo",
  };

  const fixed = applyQuickFixLocal(PERFECT_CONCEPT, finding);
  assert.equal(fixed, PERFECT_CONCEPT);
});

test("rule_id desconocido (no hay fix) → markdown intacto", () => {
  const finding: ValidationFinding = {
    rule_id: "n3-unknown-rule",
    level: "n3",
    severity: "error",
    message_es: "Regla desconocida",
    fix: {
      kind: "set_field",
      description_es: "Fix que no es soportado",
    },
  };

  const fixed = applyQuickFixLocal(PERFECT_CONCEPT, finding);
  assert.equal(fixed, PERFECT_CONCEPT);
});
