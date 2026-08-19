// __tests__/lib/kdb/reticula.test.ts
// ADR-218 D-218.2 / D-218.7: la retícula se ordena por la geometría de la tabla, y el
// volumen distingue «cero conceptos» de «no pude contar». Usa node:test (mismo motivo
// que pool.test.ts). Registrado en el glob '__tests__/lib/kdb/**/*.test.ts' de test:node.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  construirReticula,
  normalizarVolumen,
  type HocflitBlockRow,
} from "../../../lib/kdb/reticula";

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

describe("normalizarVolumen", () => {
  const SISTEMAS = ["c-comercial", "f-finanzas", "l-legal"] as const;

  it("un sistema sin conceptos vale 0, no se omite (D-218.7: lo vacío se ve vacío)", () => {
    const volumen = normalizarVolumen([{ system_slug: "c-comercial", total: 12 }], SISTEMAS);

    assert.deepStrictEqual(volumen, { "c-comercial": 12, "f-finanzas": 0, "l-legal": 0 });
  });

  it("acepta el COUNT como string, que es lo que devuelve pg sin cast", () => {
    const volumen = normalizarVolumen([{ system_slug: "l-legal", total: "7" }], SISTEMAS);

    assert.strictEqual(volumen["l-legal"], 7);
  });

  it("ignora conceptos sin sistema en vez de cargárselos a una columna", () => {
    const volumen = normalizarVolumen(
      [
        { system_slug: null, total: 99 },
        { system_slug: "f-finanzas", total: 2 },
      ],
      SISTEMAS
    );

    assert.deepStrictEqual(volumen, { "c-comercial": 0, "f-finanzas": 2, "l-legal": 0 });
  });

  it("ignora un total no numérico en vez de propagar NaN al dibujo", () => {
    const volumen = normalizarVolumen([{ system_slug: "c-comercial", total: "sin-datos" }], SISTEMAS);

    assert.strictEqual(volumen["c-comercial"], 0);
  });
});
