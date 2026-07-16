// __tests__/lib/partners/sources.test.ts
// KL2-W1: tests unitarios de validación zod para la biblioteca de fuentes.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  RegisterUrlSourceSchema,
  RegisterDocSourceMetaSchema,
  DistillSourceBodySchema,
} from "../../../lib/partners/sources";

describe("RegisterUrlSourceSchema", () => {
  it("válido: kind='url' con http(s) bien formado => success", () => {
    const data = { kind: "url", title: "Guía CONDUSEF", url: "https://condusef.gob.mx/guia" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.deepStrictEqual(result.data, data);
    }
  });

  it("válido: http (sin s) también pasa", () => {
    const data = { kind: "url", title: "Sitio legacy", url: "http://example.com/doc" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, true);
  });

  it("inválido: URL malformada => 422 (falla el schema)", () => {
    const data = { kind: "url", title: "Fuente", url: "no-es-una-url" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, false);
  });

  it("inválido: URL con protocolo no http(s) (ftp) => falla", () => {
    const data = { kind: "url", title: "Fuente", url: "ftp://example.com/archivo" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, false);
    if (!result.success) {
      const urlIssue = result.error.issues.find((i) => i.path[0] === "url");
      assert.ok(urlIssue, "debe haber un error en 'url'");
    }
  });

  it("inválido: kind distinto de 'url' => falla", () => {
    const data = { kind: "doc", title: "Fuente", url: "https://example.com" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, false);
  });

  it("inválido: title vacío => falla", () => {
    const data = { kind: "url", title: "", url: "https://example.com" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, false);
  });

  it("inválido: title > 200 chars => falla", () => {
    const data = { kind: "url", title: "a".repeat(201), url: "https://example.com" };
    const result = RegisterUrlSourceSchema.safeParse(data);
    assert.strictEqual(result.success, false);
  });
});

describe("RegisterDocSourceMetaSchema", () => {
  it("válido: title presente => success", () => {
    const result = RegisterDocSourceMetaSchema.safeParse({ title: "Machote de contrato" });
    assert.strictEqual(result.success, true);
  });

  it("inválido: title ausente (formData sin campo) => falla", () => {
    const result = RegisterDocSourceMetaSchema.safeParse({ title: null });
    assert.strictEqual(result.success, false);
  });

  it("inválido: title vacío => falla", () => {
    const result = RegisterDocSourceMetaSchema.safeParse({ title: "" });
    assert.strictEqual(result.success, false);
  });
});

describe("DistillSourceBodySchema", () => {
  it("válido: package_id UUID => success", () => {
    const result = DistillSourceBodySchema.safeParse({
      package_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    assert.strictEqual(result.success, true);
  });

  it("inválido: package_id no-UUID => falla", () => {
    const result = DistillSourceBodySchema.safeParse({ package_id: "no-es-uuid" });
    assert.strictEqual(result.success, false);
  });

  it("inválido: package_id ausente => falla", () => {
    const result = DistillSourceBodySchema.safeParse({});
    assert.strictEqual(result.success, false);
  });
});
