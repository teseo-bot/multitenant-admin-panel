// __tests__/lib/tenants/telegram-whitelist.test.ts
// La whitelist se convertía dos veces y reventaba con «split is not a function». Estos casos
// fijan que la conversión es idempotente y tolera la forma vieja del cliente cacheado.
// Recogido por el glob '__tests__/lib/tenants/**/*.test.ts' de test:node.

import { describe, it } from "node:test";
import assert from "node:assert";
import { normalizarWhitelist } from "../../../lib/tenants/telegram-whitelist";

describe("normalizarWhitelist", () => {
  it("parte el texto separado por comas y limpia espacios", () => {
    assert.deepStrictEqual(normalizarWhitelist("12345, 67890"), ["12345", "67890"]);
  });

  it("acepta un array ya convertido — el caso del bundle cacheado", () => {
    assert.deepStrictEqual(normalizarWhitelist(["12345", "67890"]), ["12345", "67890"]);
  });

  it("es idempotente: convertir dos veces da lo mismo", () => {
    const una = normalizarWhitelist("12345,67890");
    assert.deepStrictEqual(normalizarWhitelist(una), una);
  });

  it("vacío, null y undefined dan lista vacía, no revientan", () => {
    for (const v of ["", null, undefined, []]) {
      assert.deepStrictEqual(normalizarWhitelist(v), [], `falló con ${JSON.stringify(v)}`);
    }
  });

  it("descarta entradas vacías de una lista con comas de más", () => {
    assert.deepStrictEqual(normalizarWhitelist("12345,,  ,67890,"), ["12345", "67890"]);
  });

  it("acepta números en el array sin convertirlos en NaN", () => {
    assert.deepStrictEqual(normalizarWhitelist([12345, 67890]), ["12345", "67890"]);
  });
});
