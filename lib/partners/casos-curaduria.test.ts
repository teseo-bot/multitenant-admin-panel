// lib/partners/casos-curaduria.test.ts
// ADR-224 paso 3: la curaduría de casos desde el panel de control, con el guard, el compiler y la
// base falsos.

import { test, describe } from "node:test";
import * as assert from "node:assert/strict";
import type { GuardResult } from "@/lib/auth/guards";
import { CompilerCallError } from "./compiler-client";
import {
  compilerCuraduria,
  casoDeCuraduria,
  colaDeCuraduria,
  devolverCaso,
  publicarCaso,
  type CuraduriaDeps,
} from "./casos-curaduria";

const CASO = "33333333-3333-4333-8333-333333333333";
const ALIADO = "44444444-4444-4444-8444-444444444444";
const ADMIN_UID = "uid-admin-micontexto";

function guard(admin: boolean | null): CuraduriaDeps["guard"] {
  return async (): Promise<GuardResult> => {
    if (admin === null) return { ok: false, status: 401, error: "No autorizado" };
    if (!admin) return { ok: false, status: 403, error: "Requiere privilegio de Platform Admin" };
    return { ok: true, user: { id: ADMIN_UID, email: "admin@micontexto.com", platformAdmin: true } };
  };
}

function casoBase(extra: Record<string, unknown> = {}) {
  return {
    id: CASO,
    partner_id: ALIADO,
    slug: "caso",
    estado: "en_revision",
    titulo: "Caso",
    frontmatter: {
      evidencia: { fuentes: [`doc:sha256:${"c".repeat(64)}`, "url:https://cliente.mx/reporte"] },
    },
    hallazgos: [],
    versiones: [],
    ...extra,
  };
}

function deps(admin: boolean | null, llamadas: any[] = [], compiler: Partial<CuraduriaDeps["compiler"]> = {}): CuraduriaDeps {
  return {
    guard: guard(admin),
    compiler: {
      listar: async () => ({ casos: [casoBase() as any] }),
      obtener: async () => ({ caso: casoBase() as any }),
      devolver: async (input) => {
        llamadas.push({ accion: "devolver", input });
        return { caso: casoBase({ estado: "borrador" }) as any };
      },
      publicar: async (input) => {
        llamadas.push({ accion: "publicar", input });
        return { caso: casoBase({ estado: "publicado" }) as any };
      },
      ...compiler,
    },
    query: async (text: string) => {
      if (text.includes("FROM partners")) return { rows: [{ id: ALIADO, slug: "proveedor", legal_name: "Proveedor S.A." }] };
      if (text.includes("FROM partner_sources")) {
        return { rows: [{ source_ref: `doc:sha256:${"c".repeat(64)}`, title: "Reporte del cliente", gcs_object: "kdb-partner-x/_fuentes/r.pdf" }] };
      }
      return { rows: [] };
    },
    logError: () => {},
  };
}

describe("acceso", () => {
  test("sin sesión → 401; sin Platform Admin → 403; el compiler no se llama", async () => {
    const llamadas: any[] = [];
    assert.equal((await colaDeCuraduria(deps(null, llamadas))).status, 401);
    assert.equal((await publicarCaso(deps(false, llamadas), CASO)).status, 403);
    assert.equal((await devolverCaso(deps(false, llamadas), CASO, { motivo: "Un motivo suficiente." })).status, 403);
    assert.equal(llamadas.length, 0);
  });
});

describe("el curador es el de la sesión", () => {
  test("publicar y devolver mandan el uid de la sesión e ignoran uno del body", async () => {
    const llamadas: any[] = [];
    const d = deps(true, llamadas);
    assert.equal((await publicarCaso(d, CASO)).status, 200);
    assert.equal(
      (await devolverCaso(d, CASO, { motivo: "Falta de dónde sale la cifra.", curador_uid: "otro" })).status,
      200
    );
    assert.deepEqual(
      llamadas.map((l) => l.input.curador_uid),
      [ADMIN_UID, ADMIN_UID]
    );
  });

  test("devolver sin un motivo legible → 422 sin llamar al compiler", async () => {
    const llamadas: any[] = [];
    const r = await devolverCaso(deps(true, llamadas), CASO, { motivo: "   corto  " });
    assert.equal(r.status, 422);
    assert.match((r.body as { error: string }).error, /aliado leerá/);
    assert.equal(llamadas.length, 0);
  });
});

describe("lectura", () => {
  test("la cola trae el nombre del aliado", async () => {
    const r = await colaDeCuraduria(deps(true));
    const { casos } = r.body as { casos: { aliado: { legal_name: string } }[] };
    assert.equal(casos[0]?.aliado.legal_name, "Proveedor S.A.");
  });

  test("la ficha resuelve las fuentes: el documento por la biblioteca del aliado, la URL como enlace", async () => {
    const r = await casoDeCuraduria(deps(true), CASO);
    assert.equal(r.status, 200);
    const { fuentes } = r.body as { fuentes: { titulo: string | null; url: string | null; gcs_object: string | null }[] };
    assert.equal(fuentes[0]?.titulo, "Reporte del cliente");
    assert.equal(fuentes[0]?.gcs_object, "kdb-partner-x/_fuentes/r.pdf");
    assert.equal(fuentes[1]?.url, "https://cliente.mx/reporte");
  });

  test("un id que no es UUID → 404 sin llamar al compiler", async () => {
    assert.equal((await casoDeCuraduria(deps(true), "../../etc")).status, 404);
  });
});

describe("errores del compiler", () => {
  test("409 viaja con su estado; 401 por clave equivocada sale como 502 con la causa", async () => {
    const conflicto = deps(true, [], {
      publicar: async () => {
        throw new CompilerCallError("x", 409, { error: "Sólo se publica un caso en revisión", estado: "publicado" });
      },
    });
    const r = await publicarCaso(conflicto, CASO);
    assert.equal(r.status, 409);
    assert.equal((r.body as { estado: string }).estado, "publicado");

    const claveMala = deps(true, [], {
      listar: async () => {
        throw new CompilerCallError("Unauthorized: Invalid or missing x-api-key.", 401, {});
      },
    });
    const r2 = await colaDeCuraduria(claveMala);
    assert.equal(r2.status, 502);
    assert.match((r2.body as { details: string }).details, /x-api-key/);
  });
});

describe("cliente del compiler", () => {
  test("no usa la caché de datos de Next: el estado de un caso nunca se sirve viejo", async () => {
    const original = globalThis.fetch;
    const vistos: RequestInit[] = [];
    process.env.CURADURIA_M2M_API_KEY = "clave-de-prueba";
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      vistos.push(init ?? {});
      return new Response(JSON.stringify({ caso: { id: CASO } }), { status: 200 });
    }) as typeof fetch;
    try {
      await compilerCuraduria.obtener(CASO);
      await compilerCuraduria.listar();
    } finally {
      globalThis.fetch = original;
    }
    assert.deepEqual(vistos.map((i) => i.cache), ["no-store", "no-store"]);
    assert.equal((vistos[0]?.headers as Record<string, string>)["x-api-key"], "clave-de-prueba");
  });
});
