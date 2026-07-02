// __tests__/lib/knowledge-ops/tree-utils.test.ts
// K7-W3: Tests unitarios de tree-utils — agrupación de conceptos en árbol.

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildConceptTree,
  getConceptName,
} from "../../../lib/knowledge-ops/tree-utils";

describe("buildConceptTree", () => {
  it("agrupa conceptos por directorio (sistema)", () => {
    const paths = [
      "c-comercial/objeciones.md",
      "c-comercial/precios.md",
      "o-operaciones/procesos.md",
    ];
    const tree = buildConceptTree(paths);

    assert.strictEqual(tree.length, 2);
    const comercial = tree.find((n) => n.name === "c-comercial");
    assert.ok(comercial);
    assert.strictEqual(comercial.isDirectory, true);
    assert.strictEqual(comercial.children.length, 2);
    assert.ok(
      comercial.children.some((c) => c.name === "objeciones.md")
    );
  });

  it("ordena sistemas en orden HOCFLIT", () => {
    const paths = [
      "t-tecnologia/backend.md",
      "h-talento-humano/contratos.md",
      "c-comercial/objeciones.md",
    ];
    const tree = buildConceptTree(paths);

    assert.strictEqual(tree[0].name, "h-talento-humano");
    assert.strictEqual(tree[1].name, "c-comercial");
    assert.strictEqual(tree[2].name, "t-tecnologia");
  });

  it("coloca _staging al final", () => {
    const paths = [
      "c-comercial/objeciones.md",
      "_staging/2026-07-01/draft.md",
    ];
    const tree = buildConceptTree(paths);

    const lastNode = tree[tree.length - 1];
    assert.strictEqual(lastNode.name, "_staging");
  });

  it("ordena archivos alfabéticamente dentro de un directorio", () => {
    const paths = [
      "c-comercial/zebra.md",
      "c-comercial/apple.md",
      "c-comercial/mango.md",
    ];
    const tree = buildConceptTree(paths);

    const comercial = tree.find((n) => n.name === "c-comercial");
    assert.ok(comercial);
    assert.strictEqual(comercial.children[0].name, "apple.md");
    assert.strictEqual(comercial.children[1].name, "mango.md");
    assert.strictEqual(comercial.children[2].name, "zebra.md");
  });

  it("maneja directorios anidados", () => {
    const paths = [
      "c-comercial/subsistema/nivel3.md",
      "c-comercial/subsistema/nivel3-2.md",
    ];
    const tree = buildConceptTree(paths);

    const comercial = tree.find((n) => n.name === "c-comercial");
    assert.ok(comercial);
    const subsistema = comercial.children.find((c) => c.name === "subsistema");
    assert.ok(subsistema);
    assert.strictEqual(subsistema.isDirectory, true);
    assert.strictEqual(subsistema.children.length, 2);
  });

  it("devuelve arreglo vacío si no hay paths", () => {
    const tree = buildConceptTree([]);
    assert.strictEqual(tree.length, 0);
  });

  it("ignora paths vacíos", () => {
    const paths = ["c-comercial/objeciones.md", "", "o-operaciones/procesos.md"];
    const tree = buildConceptTree(paths);
    assert.strictEqual(tree.length, 2);
  });
});

describe("getConceptName", () => {
  it("extrae el nombre sin extensión .md", () => {
    assert.strictEqual(getConceptName("c-comercial/objeciones.md"), "objeciones");
  });

  it("retorna el path completo si no tiene .md", () => {
    assert.strictEqual(getConceptName("c-comercial/subsistema"), "subsistema");
  });

  it("maneja paths con un solo componente", () => {
    assert.strictEqual(getConceptName("archivo.md"), "archivo");
  });

  it("maneja directorios (sin .md)", () => {
    assert.strictEqual(getConceptName("c-comercial"), "c-comercial");
  });
});
