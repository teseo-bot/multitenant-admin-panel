// __tests__/lib/partners/assist.test.ts
// KL3-W2: tests unitarios del proxy del asistente IA — schema + lógica de pertenencia de
// source_ids (resolveSourceGcsObjects), extraída de la ruta para poder testearla sin invocar
// `pool.query` real (mismo patrón que lib/partners/session.ts::requirePartnerMember).

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  AssistBodySchema,
  AssistFindingSchema,
  resolveSourceGcsObjects,
  type PartnerSourceForAssist,
} from "../../../lib/partners/assist";

const PARTNER_ID = "550e8400-e29b-41d4-a716-446655440000";
const SOURCE_A = "550e8400-e29b-41d4-a716-446655440001";
const SOURCE_B = "550e8400-e29b-41d4-a716-446655440002";
const SOURCE_FOREIGN = "550e8400-e29b-41d4-a716-446655440099";

function makeQueryStub(rows: PartnerSourceForAssist[]) {
  return async (_text: string, _params: unknown[]) => ({ rows });
}

describe("AssistBodySchema", () => {
  it("válido: mode='draft_from_source' con source_ids => success", () => {
    const result = AssistBodySchema.safeParse({
      mode: "draft_from_source",
      source_ids: [SOURCE_A],
      concept_type: "Politica",
      system: "l-legal",
    });
    assert.strictEqual(result.success, true);
  });

  it("válido: mode='reorganize' con markdown => success", () => {
    const result = AssistBodySchema.safeParse({ mode: "reorganize", markdown: "---\ntype: Insight\n---\ncuerpo" });
    assert.strictEqual(result.success, true);
  });

  it("válido: mode='fix_findings' con markdown + findings => success", () => {
    const result = AssistBodySchema.safeParse({
      mode: "fix_findings",
      markdown: "---\ntype: Insight\n---\ncuerpo",
      findings: [
        { rule_id: "n2-timestamp", level: "n2", severity: "error", message_es: "timestamp inválido" },
      ],
    });
    assert.strictEqual(result.success, true);
  });

  it("inválido: mode desconocido => falla", () => {
    const result = AssistBodySchema.safeParse({ mode: "inventado" });
    assert.strictEqual(result.success, false);
  });

  it("inválido: source_ids con string no-UUID => falla", () => {
    const result = AssistBodySchema.safeParse({ mode: "draft_from_source", source_ids: ["no-es-uuid"] });
    assert.strictEqual(result.success, false);
  });
});

describe("AssistFindingSchema", () => {
  it("válido: finding completo => success", () => {
    const result = AssistFindingSchema.safeParse({
      rule_id: "n2-title",
      level: "n2",
      severity: "error",
      message_es: "title es obligatorio",
      line: 3,
      fix: { kind: "set_field", description_es: "Generar title", value: "Título" },
    });
    assert.strictEqual(result.success, true);
  });

  it("inválido: sin rule_id => falla", () => {
    const result = AssistFindingSchema.safeParse({
      level: "n2",
      severity: "error",
      message_es: "algo",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("resolveSourceGcsObjects", () => {
  it("todas las fuentes pertenecen al partner y son kind='doc' => ok:true con gcs_objects en orden de source_ids", async () => {
    const query = makeQueryStub([
      { id: SOURCE_B, kind: "doc", gcs_object: "_fuentes/bbb.pdf" },
      { id: SOURCE_A, kind: "doc", gcs_object: "_fuentes/aaa.pdf" },
    ]);

    const result = await resolveSourceGcsObjects([SOURCE_A, SOURCE_B], PARTNER_ID, query);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.deepStrictEqual(result.gcs_objects, ["_fuentes/aaa.pdf", "_fuentes/bbb.pdf"]);
    }
  });

  it("[RP-KL7] source_id ausente/de otro partner => 403", async () => {
    // La query simulada, filtrando por partner_id real, solo devuelve SOURCE_A: SOURCE_FOREIGN
    // no aparece (no existe o es de otro aliado — desde afuera se ve igual).
    const query = makeQueryStub([{ id: SOURCE_A, kind: "doc", gcs_object: "_fuentes/aaa.pdf" }]);

    const result = await resolveSourceGcsObjects([SOURCE_A, SOURCE_FOREIGN], PARTNER_ID, query);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
      assert.ok(result.error.includes(SOURCE_FOREIGN));
    }
  });

  it("source con kind='url' => 422 (URLs no soportadas para el asistente en v1)", async () => {
    const query = makeQueryStub([
      { id: SOURCE_A, kind: "doc", gcs_object: "_fuentes/aaa.pdf" },
      { id: SOURCE_B, kind: "url", gcs_object: null },
    ]);

    const result = await resolveSourceGcsObjects([SOURCE_A, SOURCE_B], PARTNER_ID, query);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 422);
    }
  });

  it("lista vacía de resultados cuando ningún source_id existe => 403", async () => {
    const query = makeQueryStub([]);

    const result = await resolveSourceGcsObjects([SOURCE_FOREIGN], PARTNER_ID, query);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
    }
  });
});
