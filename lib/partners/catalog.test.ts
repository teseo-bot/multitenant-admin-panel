// lib/partners/catalog.test.ts
// Tests para PA7-W4 catálogo interno de paquetes de aliados.

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import { filterCatalog, type CatalogItem } from "./catalog";

const mockItems: CatalogItem[] = [
  {
    package_id: "pkg-001",
    package_slug: "template-contrato",
    title: "Plantilla de Contrato Laboral",
    description: "Plantilla estándar de contrato laboral",
    systems: ["l-legal", "l-rrhh"],
    altitude_max: 3,
    partner_id: "p-001",
    partner_slug: "legal-partners",
    legal_name: "Legal Partners S.A.",
    vertical: "legal",
    latest_version: 2,
    active_contracts: 5,
  },
  {
    package_id: "pkg-002",
    package_slug: "marketing-analytics",
    title: "Marketing Analytics Suite",
    description: "Suite completa de análisis de marketing",
    systems: ["l-marketing"],
    altitude_max: 2,
    partner_id: "p-002",
    partner_slug: "growth-labs",
    legal_name: "Growth Labs Inc.",
    vertical: "marketing",
    latest_version: 1,
    active_contracts: 3,
  },
  {
    package_id: "pkg-003",
    package_slug: "hr-strategy",
    title: "HR Strategy Consultation",
    description: "Consultoría estratégica de recursos humanos",
    systems: ["l-rrhh"],
    altitude_max: 4,
    partner_id: "p-003",
    partner_slug: "talent-advisors",
    legal_name: "Talent Advisors LLC",
    vertical: "reclutamiento",
    latest_version: null,
    active_contracts: 0,
  },
];

describe("filterCatalog", () => {
  test("filtro vacío devuelve todo", () => {
    const result = filterCatalog(mockItems, "");
    assert.equal(result.length, 3);
  });

  test("filtra por legal_name case-insensitive", () => {
    const result = filterCatalog(mockItems, "legal");
    assert.equal(result.length, 1);
    assert.equal(result[0].legal_name, "Legal Partners S.A.");
  });

  test("filtra por legal_name uppercase", () => {
    const result = filterCatalog(mockItems, "LEGAL PARTNERS");
    assert.equal(result.length, 1);
    assert.equal(result[0].legal_name, "Legal Partners S.A.");
  });

  test("filtra por title", () => {
    const result = filterCatalog(mockItems, "marketing");
    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Marketing Analytics Suite");
  });

  test("filtra por vertical", () => {
    const result = filterCatalog(mockItems, "reclutamiento");
    assert.equal(result.length, 1);
    assert.equal(result[0].vertical, "reclutamiento");
  });

  test("sin matches devuelve array vacío", () => {
    const result = filterCatalog(mockItems, "nonexistent");
    assert.equal(result.length, 0);
  });

  test("whitespace solo devuelve todo", () => {
    const result = filterCatalog(mockItems, "   ");
    assert.equal(result.length, 3);
  });
});
