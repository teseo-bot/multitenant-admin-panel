// __tests__/lib/kdb/alcance.test.ts
// ADR-220 D-220.5: el eje de alcance sale de `tenant_brands` y no de un literal del panel
// del tenant. Usa node:test; registrado en el glob '__tests__/lib/kdb/**/*.test.ts' de
// test:node (los runners de este repo son listas explícitas, no descubrimiento).

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  construirEjeMarca,
  construirEjeProyecto,
  type TenantBrandRow,
} from "../../../lib/kdb/alcance";

const FLEETCO: TenantBrandRow = { slug: "fleetco", display_name: "Fleetco" };
const CARGALO: TenantBrandRow = { slug: "cargalo", display_name: "Cargalo" };

describe("construirEjeMarca", () => {
  it("con dos marcas activas devuelve el eje con las dos opciones", () => {
    const eje = construirEjeMarca([FLEETCO, CARGALO]);
    assert.ok(eje);
    assert.strictEqual(eje.clave, "marca");
    assert.deepStrictEqual(
      eje.opciones.map((o) => o.slug),
      ["fleetco", "cargalo"]
    );
  });

  it("el conjunto vacío es «compartido» y ES el default ([INV-215.5])", () => {
    // La mayoría del corpus sirve a todas las marcas. Si el default fuera la exclusividad,
    // el material de mercado acabaría etiquetado por producto y el retargeting —la razón de
    // tener dos marcas en un tenant— dejaría de funcionar.
    const eje = construirEjeMarca([FLEETCO, CARGALO]);
    assert.strictEqual(eje?.compartido.es_default, true);
  });

  it("sin marcas no hay eje: el tenant no declara ninguno", () => {
    // Es el caso del tenant del entrevistador hoy. No es un error: el paso no se dibuja.
    assert.strictEqual(construirEjeMarca([]), null);
  });

  it("con UNA sola marca tampoco hay eje", () => {
    // «Compartido» y «sólo Fleetco» alcanzan al mismo agente cuando Fleetco es la única
    // marca. Un selector ahí ofrece una decisión que no existe, y quien la tome creerá
    // haber acotado algo.
    assert.strictEqual(construirEjeMarca([FLEETCO]), null);
  });

  it("el rótulo de cada opción sale de display_name, no del slug", () => {
    const eje = construirEjeMarca([
      { slug: "acme-mx", display_name: "ACME México" },
      CARGALO,
    ]);
    assert.strictEqual(eje?.opciones[0].label, "Solo ACME México");
    assert.strictEqual(eje?.opciones[0].slug, "acme-mx");
  });

  it("no inventa slugs: los que salen son exactamente los del registro", () => {
    // El panel del tenant valida la carga contra estos slugs, así que si aquí apareciera
    // uno derivado —minusculizado, con acentos quitados— la ingesta rechazaría con 400 un
    // valor que el propio selector acaba de ofrecer.
    const filas = [
      { slug: "Marca_Rara", display_name: "Marca Rara" },
      CARGALO,
    ];
    const eje = construirEjeMarca(filas);
    assert.deepStrictEqual(
      eje?.opciones.map((o) => o.slug),
      ["Marca_Rara", "cargalo"]
    );
  });
});

const ACME: TenantBrandRow = { slug: "acme-2026", display_name: "ACME 2026" };
const BETA: TenantBrandRow = { slug: "beta-retail", display_name: "Beta Retail" };

describe("construirEjeProyecto", () => {
  it("con UN solo proyecto YA hay eje — al revés que la marca", () => {
    // Con una marca, «compartido» y «sólo esa marca» alcanzan al mismo agente. Con un solo
    // cliente NO es así: hay que separar su material de la metodología común.
    const eje = construirEjeProyecto([ACME]);
    assert.ok(eje);
    assert.strictEqual(eje.clave, "proyecto");
    assert.deepStrictEqual(eje.opciones.map((o) => o.slug), ["acme-2026"]);
  });

  it("el vacío NO es el default (D-220.2)", () => {
    // Es la decisión de fondo del ADR. Si esto fuera `true`, el aislamiento por proyecto
    // quedaría opt-in y el que se olvida publicaría a todos los clientes.
    assert.strictEqual(construirEjeProyecto([ACME, BETA])?.compartido.es_default, false);
  });

  it("y sigue significando «base del tenant», no «nadie»", () => {
    // Mismo predicado que la marca, a propósito: lo contrario dejaría inaccesible todo lo
    // cargado antes de que existieran los proyectos.
    const eje = construirEjeProyecto([ACME]);
    assert.match(eje!.compartido.descripcion, /todos los agentes del tenant/i);
  });

  it("sin proyectos no hay eje", () => {
    assert.strictEqual(construirEjeProyecto([]), null);
  });

  it("no inventa slugs: los que salen son los del registro", () => {
    // El panel valida la carga contra estos slugs. Uno derivado aquí haría que la ingesta
    // rechazara con 400 un valor que el propio selector acaba de ofrecer.
    const eje = construirEjeProyecto([{ slug: "Proy_Raro", display_name: "Proyecto Raro" }]);
    assert.deepStrictEqual(eje?.opciones.map((o) => o.slug), ["Proy_Raro"]);
  });

  it("marca y proyecto son ejes DISTINTOS y se distinguen por `clave`", () => {
    // De esta clave depende por qué campo viaja la selección al ingerir. Si los dos ejes
    // dijeran lo mismo, el proyecto montaría la columna de marca — la conflación que D-220.1
    // prohíbe, y que haría que el predicado correcto dependiera del tenant.
    assert.notStrictEqual(
      construirEjeProyecto([ACME])?.clave,
      construirEjeMarca([FLEETCO, CARGALO])?.clave
    );
  });
});
