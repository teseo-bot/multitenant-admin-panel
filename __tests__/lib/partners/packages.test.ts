// __tests__/lib/partners/packages.test.ts
// Tests unitarios de validación zod para paquetes de aliados.

import { describe, it } from "node:test";
import assert from "node:assert";
import { CreatePackageBodySchema } from "../../../lib/partners/packages";

describe("CreatePackageBodySchema", () => {
  it("válido: paquete bien formado => success", () => {
    const data = {
      slug: "procesos-seleccion",
      title: "Procesos de Selección",
      description: "Procesos y criterios de selección",
      systems: ["h-talento-humano", "o-operaciones"],
      altitude_max: 3,
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.deepStrictEqual(result.data, data);
    }
  });

  it("válido: sin description => usa default ''", () => {
    const data = {
      slug: "procesos-seleccion",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
      altitude_max: 3,
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.description, "");
    }
  });

  it("válido: sin altitude_max => usa default 3", () => {
    const data = {
      slug: "procesos-seleccion",
      title: "Procesos de Selección",
      description: "Test",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.altitude_max, 3);
    }
  });

  it("inválido: slug no cumple regex (empieza con guion)", () => {
    const data = {
      slug: "-procesos-seleccion",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      const slugIssue = result.error.issues.find((i) => i.path[0] === "slug");
      assert.ok(slugIssue, "debe haber un error en 'slug'");
    }
  });

  // El regex del TRD `^[a-z0-9][a-z0-9-]{2,59}$` admite mínimo 3 caracteres.
  it("válido: slug de 3 chars (mínimo del regex TRD)", () => {
    const data = {
      slug: "abc",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, true);
  });

  it("inválido: slug de 2 chars (bajo el mínimo)", () => {
    const data = {
      slug: "ab",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: slug con mayúsculas", () => {
    const data = {
      slug: "Procesos-Seleccion",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: title muy corto (< 3 chars)", () => {
    const data = {
      slug: "proc",
      title: "ab",
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      const titleIssue = result.error.issues.find((i) => i.path[0] === "title");
      assert.ok(titleIssue, "debe haber un error en 'title'");
    }
  });

  it("inválido: title > 120 chars", () => {
    const data = {
      slug: "proc",
      title: "a".repeat(121),
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: description > 500 chars", () => {
    const data = {
      slug: "proc",
      title: "Procesos",
      description: "a".repeat(501),
      systems: ["h-talento-humano"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: systems vacío", () => {
    const data = {
      slug: "proc",
      title: "Procesos de Selección",
      systems: [],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      const systemsIssue = result.error.issues.find(
        (i) => i.path[0] === "systems"
      );
      assert.ok(systemsIssue, "debe haber un error en 'systems'");
    }
  });

  it("inválido: system no-HOCFLIT", () => {
    const data = {
      slug: "proc",
      title: "Procesos de Selección",
      systems: ["h-talento-humano", "x-sistema-inexistente"],
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: altitude_max < 1", () => {
    const data = {
      slug: "proc",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
      altitude_max: 0,
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("inválido: altitude_max > 5", () => {
    const data = {
      slug: "proc",
      title: "Procesos de Selección",
      systems: ["h-talento-humano"],
      altitude_max: 6,
    };

    const result = CreatePackageBodySchema.safeParse(data);

    assert.strictEqual(result.success, false);
  });

  it("válido: altitude_max en rango 1-5", () => {
    for (let alt = 1; alt <= 5; alt++) {
      const data = {
        slug: "proc",
        title: "Procesos de Selección",
        systems: ["h-talento-humano"],
        altitude_max: alt,
      };

      const result = CreatePackageBodySchema.safeParse(data);

      assert.strictEqual(
        result.success,
        true,
        `altitude_max=${alt} debe ser válido`
      );
    }
  });
});
