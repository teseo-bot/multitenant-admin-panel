// __tests__/lib/partners/session.test.ts
// KL1-W1: tests unitarios de requirePartnerMember (lib/partners/session.ts).
// Usa node:test (mismo motivo que __tests__/lib/kdb/pool.test.ts y review.test.ts:
// vitest no está instalado en node_modules/.bin pese a existir vitest.config.ts).
//
// requirePartnerMember acepta un 2º parámetro `deps` (solo para tests) que inyecta
// lectura de cookie / verificación de sesión / query — evita mockear `next/headers`
// (cookies() explota fuera de un request scope real: "called outside a request
// scope") y firebase-admin (verifySession real llama a adminAuth(), que exige
// credenciales GCP). En producción los tres defaults reales se usan siempre.

import { describe, it } from "node:test";
import assert from "node:assert";
import { requirePartnerMember } from "../../../lib/partners/session";

function fakeDeps(opts: {
  cookie?: string;
  decoded?: { uid: string; partner_id?: string } | null;
  rows?: any[];
}) {
  const queryCalls: Array<{ text: string; params: unknown[] }> = [];
  return {
    queryCalls,
    deps: {
      getSessionCookieValue: async () => opts.cookie,
      verifySession: async (cookieValue: string) =>
        cookieValue === opts.cookie ? opts.decoded ?? null : null,
      query: async (text: string, params: unknown[]) => {
        queryCalls.push({ text, params });
        return { rows: opts.rows ?? [] };
      },
    },
  };
}

describe("requirePartnerMember", () => {
  it("claim válido + fila en partner_members => ok", async () => {
    const { deps } = fakeDeps({
      cookie: "valid-cookie",
      decoded: { uid: "uid-1", partner_id: "partner-1" },
      rows: [
        {
          partner_id: "partner-1",
          member_role: "member",
          slug: "bufete-demo",
          legal_name: "Bufete Demo SC",
          status: "verified",
        },
      ],
    });

    const result = await requirePartnerMember(undefined, deps);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.uid, "uid-1");
      assert.strictEqual(result.member_role, "member");
      assert.strictEqual(result.partner.legal_name, "Bufete Demo SC");
    }
  });

  it("claim válido pero SIN fila en partner_members => rechazo 403 (RP-KL7)", async () => {
    const { deps, queryCalls } = fakeDeps({
      cookie: "valid-cookie",
      decoded: { uid: "uid-2", partner_id: "partner-1" },
      rows: [],
    });

    const result = await requirePartnerMember(undefined, deps);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
    }
    // El claim SÍ se usó para acotar la query (defensa en profundidad / documentación
    // del comportamiento, no solo el resultado).
    assert.strictEqual(queryCalls.length, 1);
    assert.deepStrictEqual(queryCalls[0].params, ["partner-1", "uid-2"]);
  });

  it("sin cookie de sesión => 401", async () => {
    const { deps, queryCalls } = fakeDeps({ cookie: undefined });

    const result = await requirePartnerMember(undefined, deps);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 401);
    }
    assert.strictEqual(queryCalls.length, 0);
  });

  it("cookie presente pero verifySession devuelve null (inválida/expirada) => 401", async () => {
    const { deps } = fakeDeps({ cookie: "stale-cookie", decoded: null });

    const result = await requirePartnerMember(undefined, deps);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 401);
    }
  });

  it("member con minRole='curator' => rechazo 403", async () => {
    const { deps } = fakeDeps({
      cookie: "valid-cookie",
      decoded: { uid: "uid-3", partner_id: "partner-1" },
      rows: [
        {
          partner_id: "partner-1",
          member_role: "member",
          slug: "bufete-demo",
          legal_name: "Bufete Demo SC",
          status: "verified",
        },
      ],
    });

    const result = await requirePartnerMember("curator", deps);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.status, 403);
    }
  });

  it("curator con minRole='curator' => ok", async () => {
    const { deps } = fakeDeps({
      cookie: "valid-cookie",
      decoded: { uid: "uid-4", partner_id: "partner-1" },
      rows: [
        {
          partner_id: "partner-1",
          member_role: "curator",
          slug: "bufete-demo",
          legal_name: "Bufete Demo SC",
          status: "verified",
        },
      ],
    });

    const result = await requirePartnerMember("curator", deps);

    assert.strictEqual(result.ok, true);
  });

  it("sin claim partner_id: busca por uid solo (fallback, espejo de get-tenant-context.ts)", async () => {
    const { deps, queryCalls } = fakeDeps({
      cookie: "valid-cookie",
      decoded: { uid: "uid-5" },
      rows: [
        {
          partner_id: "partner-2",
          member_role: "curator",
          slug: "otro-aliado",
          legal_name: "Otro Aliado SA",
          status: "verified",
        },
      ],
    });

    const result = await requirePartnerMember(undefined, deps);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(queryCalls[0].params.length, 1);
    assert.deepStrictEqual(queryCalls[0].params, ["uid-5"]);
  });
});
