// __tests__/lib/kdb/pool.test.ts
// K7-W1: verifica que withTenant() SIEMPRE hace RESET app.tenant_id + release,
// incluso cuando fn() lanza. Usa node:test (mismo motivo que review.test.ts: vitest
// no está instalado en node_modules/.bin en este repo pese a existir vitest.config.ts).
//
// `pg.Pool` no abre conexión de red al construirse (lazy connect), así que es seguro
// importar lib/kdb/pool.ts sin COLD_TIER_URL configurado y luego monkeypatchear
// kdbPool.connect con un cliente fake — no se toca la red real.

import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { kdbPool, withTenant } from "../../../lib/kdb/pool";

function makeFakeClient() {
  const queries: string[] = [];
  const client = {
    query: mock.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    }),
    release: mock.fn(() => {}),
  };
  return { client, queries };
}

describe("withTenant", () => {
  it("hace SET app.tenant_id, ejecuta fn, y hace RESET + release en éxito", async () => {
    const { client, queries } = makeFakeClient();
    const connectMock = mock.method(kdbPool, "connect", async () => client as any);

    const result = await withTenant("tenant-abc", async (c) => {
      const r = await c.query("SELECT 1");
      return r;
    });

    assert.deepStrictEqual(result, { rows: [] });
    assert.strictEqual(queries[0], "SELECT set_config('app.tenant_id', $1, false)");
    assert.strictEqual(queries[queries.length - 1], "RESET app.tenant_id");
    assert.strictEqual(client.release.mock.calls.length, 1);

    connectMock.mock.restore();
  });

  it("hace RESET app.tenant_id + release incluso si fn lanza", async () => {
    const { client, queries } = makeFakeClient();
    const connectMock = mock.method(kdbPool, "connect", async () => client as any);

    await assert.rejects(
      () =>
        withTenant("tenant-abc", async () => {
          throw new Error("boom");
        }),
      /boom/
    );

    assert.strictEqual(queries[queries.length - 1], "RESET app.tenant_id");
    assert.strictEqual(client.release.mock.calls.length, 1);

    connectMock.mock.restore();
  });

  it("hace release incluso si el propio RESET falla", async () => {
    const client = {
      query: mock.fn(async (sql: string) => {
        if (sql === "RESET app.tenant_id") {
          throw new Error("reset failed");
        }
        return { rows: [] };
      }),
      release: mock.fn(() => {}),
    };
    const connectMock = mock.method(kdbPool, "connect", async () => client as any);

    const result = await withTenant("tenant-abc", async () => "ok");

    assert.strictEqual(result, "ok");
    assert.strictEqual(client.release.mock.calls.length, 1);

    connectMock.mock.restore();
  });
});
