// __tests__/lib/tenants/operation-form.test.ts
// Un tenant en aprovisionamiento no tiene dominio, ni orquestador, ni bot: el formulario
// de operación exigía los tres y lo dejaba imposible de guardar. Estos casos fijan que
// «vacío» es un estado legítimo y que lo que sí se escribe sigue validándose.
//
// ⚠️ Registrado a mano en `test:node` (package.json). Los runners de este repo son listas
// explícitas: un *.test.ts fuera de ellas no lo corre nadie y la suite reporta verde.

import { describe, it } from "node:test";
import assert from "node:assert";
import { operationFormSchema } from "../../../app/(control-panel)/tenants/[tenantId]/schemas";

const BASE = {
  name: "Marketmaker",
  domain: "",
  orchestratorUrl: "",
  telegramBotToken: "",
  telegramWhitelistedGroupIds: "",
  status: true,
};

function valida(over: Record<string, unknown> = {}) {
  return operationFormSchema.safeParse({ ...BASE, ...over });
}

describe("operationFormSchema · el tenant en aprovisionamiento", () => {
  it("se guarda con dominio, orquestador y bot vacíos", () => {
    // Es el caso de tenant2: existe, tiene nombre, y nada más todavía.
    assert.strictEqual(valida().success, true);
  });

  it("también con los tres campos ausentes del payload", () => {
    const r = operationFormSchema.safeParse({
      name: "Marketmaker",
      telegramWhitelistedGroupIds: "",
      status: true,
    });
    assert.strictEqual(r.success, true);
  });

  it("sigue exigiendo el nombre", () => {
    assert.strictEqual(valida({ name: "M" }).success, false);
  });
});

describe("operationFormSchema · domain es un host, no una URL", () => {
  it("acepta el host pelado, que es lo que invitations.ts espera", () => {
    // invitations.ts hace `domain.startsWith("http") ? domain : `https://${domain}``.
    assert.strictEqual(valida({ domain: "comerseg.fleetco.mx" }).success, true);
  });

  it("acepta también la forma con esquema, por las filas viejas", () => {
    assert.strictEqual(valida({ domain: "https://comerseg.fleetco.mx" }).success, true);
  });

  it("rechaza un correo colado en el campo de dominio", () => {
    assert.strictEqual(valida({ domain: "jorge@micontexto.com" }).success, false);
  });

  it("rechaza una sola etiqueta sin punto", () => {
    assert.strictEqual(valida({ domain: "localhost" }).success, false);
  });
});

describe("operationFormSchema · orchestratorUrl", () => {
  it("acepta una URL completa", () => {
    assert.strictEqual(valida({ orchestratorUrl: "https://orq.tenant2.mx/api" }).success, true);
  });

  it("rechaza un correo — que es lo que el autocompletado del navegador mete ahí", () => {
    assert.strictEqual(valida({ orchestratorUrl: "jorge@micontexto.com" }).success, false);
  });

  it("rechaza un host pelado: aquí sí hace falta el esquema", () => {
    assert.strictEqual(valida({ orchestratorUrl: "orq.tenant2.mx" }).success, false);
  });
});

describe("operationFormSchema · telegramBotToken", () => {
  it("rechaza un valor corto, pero no un valor ausente", () => {
    assert.strictEqual(valida({ telegramBotToken: "123456789" }).success, false);
    assert.strictEqual(valida({ telegramBotToken: "" }).success, true);
  });

  it("acepta un token con la forma real de Telegram", () => {
    assert.strictEqual(valida({ telegramBotToken: "8852377138:AAF-ejemplo" }).success, true);
  });
});
