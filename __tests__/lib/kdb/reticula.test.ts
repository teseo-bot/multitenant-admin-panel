// __tests__/lib/kdb/reticula.test.ts
// ADR-218 D-218.2: la retícula se ordena por la geometría de la tabla. Usa node:test
// (mismo motivo que pool.test.ts). Registrado en el glob '__tests__/lib/kdb/**/*.test.ts'
// de test:node.
//
// Las pruebas de `normalizarVolumen` se mudaron el 2026-08-31 a
// tenant-admin-panel/lib/knowledge/volumen.test.ts, con la función.

import { describe, it } from "node:test";
import assert from "node:assert";
import { construirReticula, type HocflitBlockRow } from "../../../lib/kdb/reticula";

function fila(over: Partial<HocflitBlockRow> & Pick<HocflitBlockRow, "code" | "group_code">): HocflitBlockRow {
  return {
    group_name: "Grupo",
    placement: "columna",
    level: 1,
    name: "Bloque",
    description: "desc",
    system_slug: null,
    ...over,
  };
}

describe("construirReticula", () => {
  it("ordena techo → transversal → columnas del acrónimo → piso", () => {
    // Entrada deliberadamente desordenada: la tabla no garantiza orden sin ORDER BY.
    const rows = [
      fila({ code: "T1", group_code: "T", placement: "piso", system_slug: "t-tecnologia" }),
      fila({ code: "C1", group_code: "C", placement: "columna", system_slug: "c-comercial" }),
      fila({ code: "E1", group_code: "E", placement: "techo", system_slug: null }),
      fila({ code: "H1", group_code: "H", placement: "columna", system_slug: "h-talento-humano" }),
      fila({ code: "I1", group_code: "I", placement: "transversal", system_slug: "i-innovacion" }),
      fila({ code: "O1", group_code: "O", placement: "columna", system_slug: "o-operaciones" }),
    ];

    const grupos = construirReticula(rows);

    assert.deepStrictEqual(
      grupos.map((g) => g.code),
      ["E", "I", "H", "O", "C", "T"]
    );
  });

  it("ordena los bloques de cada grupo por nivel, no por el orden de llegada", () => {
    const rows = [
      fila({ code: "F3", group_code: "F", level: 3 }),
      fila({ code: "F1", group_code: "F", level: 1 }),
      fila({ code: "F5", group_code: "F", level: 5 }),
      fila({ code: "F2", group_code: "F", level: 2 }),
    ];

    const [grupo] = construirReticula(rows);

    assert.deepStrictEqual(grupo.bloques.map((b) => b.level), [1, 2, 3, 5]);
    assert.deepStrictEqual(grupo.bloques.map((b) => b.code), ["F1", "F2", "F3", "F5"]);
  });

  it("conserva system_slug NULL en la Dirección Ejecutiva (D-218.6: E no es un 8.º slug)", () => {
    const grupos = construirReticula([
      fila({ code: "E1", group_code: "E", group_name: "Dirección Ejecutiva", placement: "techo", system_slug: null }),
    ]);

    assert.strictEqual(grupos[0].system_slug, null);
    assert.strictEqual(grupos[0].nombre, "Dirección Ejecutiva");
  });

  it("no rompe el dibujo si aparece un placement que el CHECK de hoy no contempla", () => {
    const grupos = construirReticula([
      fila({ code: "X1", group_code: "X", placement: "cimientos" }),
      fila({ code: "E1", group_code: "E", placement: "techo" }),
    ]);

    // El desconocido va al final, no desaparece ni tumba la respuesta.
    assert.deepStrictEqual(grupos.map((g) => g.code), ["E", "X"]);
  });

  it("devuelve lista vacía con tabla vacía, sin inventar grupos", () => {
    assert.deepStrictEqual(construirReticula([]), []);
  });
});
