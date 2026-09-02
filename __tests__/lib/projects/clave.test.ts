// __tests__/lib/projects/clave.test.ts
// ADR-221 D-221.3: la clave del proyecto es su slug, y el alta y el emparejador tienen que
// canonizarla igual. Este fichero fija ese contrato para que el duplicado del orquestador
// (paso 3) sea comprobable contra algo. Usa node:test; registrado en el glob
// '__tests__/lib/projects/**/*.test.ts' de test:node — los runners de este repo son listas
// explícitas, no descubrimiento, así que un test en un directorio nuevo NO corre hasta que
// alguien añade su glob. Se añadió con este mismo cambio.

import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizarClave, validarClave, CLAVE_MAX } from "../../../lib/projects/clave";

describe("normalizarClave", () => {
  it("respeta el canon de los dos proyectos que ya existen en la tabla", () => {
    // `acoeq` y `cluster-plasticos` entraron por SQL a mano antes de que hubiera pantalla.
    // Si el canon los cambiara, el catálogo nacería partido en dos convenciones.
    assert.strictEqual(normalizarClave("acoeq"), "acoeq");
    assert.strictEqual(normalizarClave("cluster-plasticos"), "cluster-plasticos");
  });

  it("es insensible a mayúsculas y a espacios de sobra (D-221.3)", () => {
    assert.strictEqual(normalizarClave("PLASTICOS"), "plasticos");
    assert.strictEqual(normalizarClave("  Plasticos  "), "plasticos");
    assert.strictEqual(normalizarClave("Cluster  de   Plasticos"), "cluster-de-plasticos");
  });

  it("casa con acento y sin acento, que es como se teclea lo que se oyó", () => {
    assert.strictEqual(normalizarClave("PLÁSTICOS"), normalizarClave("plasticos"));
    assert.strictEqual(normalizarClave("Querétaro"), "queretaro");
  });

  it("colapsa cualquier separador a un solo guion y no deja guiones sueltos en los bordes", () => {
    assert.strictEqual(normalizarClave("cluster_plasticos"), "cluster-plasticos");
    assert.strictEqual(normalizarClave("--plasticos--"), "plasticos");
    assert.strictEqual(normalizarClave("plasticos 2026!"), "plasticos-2026");
  });

  it("devuelve cadena vacía sin lanzar: sobre texto de WhatsApp, «no es clave» es lo normal", () => {
    assert.strictEqual(normalizarClave("   "), "");
    assert.strictEqual(normalizarClave("¿?¡!"), "");
  });

  it("es idempotente — canonizar lo ya canónico no lo mueve", () => {
    for (const s of ["PLÁSTICOS", "  Cluster de Plasticos ", "acoeq"]) {
      assert.strictEqual(normalizarClave(normalizarClave(s)), normalizarClave(s));
    }
  });
});

describe("validarClave", () => {
  it("acepta y devuelve ya canonizado", () => {
    const r = validarClave("  Plásticos Querétaro ");
    assert.deepStrictEqual(r, { ok: true, clave: "plasticos-queretaro" });
  });

  it("rechaza lo que no deja nada utilizable", () => {
    assert.strictEqual(validarClave("¡!¿?").ok, false);
  });

  it("rechaza pasarse de largo: la clave se dice en voz alta y cabe en un slide", () => {
    assert.strictEqual(validarClave("a".repeat(CLAVE_MAX + 1)).ok, false);
    assert.strictEqual(validarClave("a".repeat(CLAVE_MAX)).ok, true);
  });

  it("rechaza la clave que es sólo números, que se confundiría con otra respuesta", () => {
    // El emparejador tendría que desempatar por contexto, y sacar eso del LLM es D-221.4.
    assert.strictEqual(validarClave("2026").ok, false);
    assert.strictEqual(validarClave("plasticos2026").ok, true);
  });
});
