// __tests__/lib/projects/enlace.test.ts
// ADR-221 D-221.4: el enlace del QR. Registrado en el glob '__tests__/lib/projects/**'.

import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizarNumeroWa, construirEnlaceWa } from "../../../lib/projects/enlace";

describe("normalizarNumeroWa", () => {
  it("deja sólo dígitos: wa.me no resuelve con «+», espacios ni paréntesis", () => {
    assert.strictEqual(normalizarNumeroWa("+52 1 (555) 123-4567"), "5215551234567");
  });

  it("devuelve null sin canal, que es el estado de tenant2 hoy", () => {
    assert.strictEqual(normalizarNumeroWa(null), null);
    assert.strictEqual(normalizarNumeroWa(""), null);
  });

  it("rechaza lo que no es un E.164: un phone_number_id de Meta daría un 404 silencioso", () => {
    assert.strictEqual(normalizarNumeroWa("12345"), null);
    assert.strictEqual(normalizarNumeroWa("1234567890123456"), null);
  });
});

describe("construirEnlaceWa", () => {
  it("precarga la clave YA canonizada — es el texto que se enviará sin tocar", () => {
    assert.strictEqual(
      construirEnlaceWa("+52 1 555 123 4567", "  Plásticos Querétaro "),
      "https://wa.me/5215551234567?text=plasticos-queretaro"
    );
  });

  it("sin número no hay enlace, y quien llame tiene que decirlo en vez de dibujar un QR roto", () => {
    assert.strictEqual(construirEnlaceWa(null, "plasticos"), null);
  });

  it("sin clave utilizable tampoco hay enlace", () => {
    assert.strictEqual(construirEnlaceWa("+525551234567", "¿?"), null);
  });
});
