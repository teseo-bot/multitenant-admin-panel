// __tests__/middleware-host.test.ts
// G2-W6: tests unitarios de la lógica pura de enrutamiento por host
// (control.micontexto.com vs aliados.micontexto.com) usada por middleware.ts.
// Correr con: node --test --import tsx __tests__/middleware-host.test.ts

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isPartnerHost,
  resolveRootRedirect,
  resolveAuthenticatedRedirect,
  isBlockedOnPartnerHost,
  sanitizeRedirectTo,
} from "../lib/host-routing";

describe("isPartnerHost", () => {
  it("host de aliados (sin puerto) => true", () => {
    assert.strictEqual(isPartnerHost("aliados.micontexto.com"), true);
  });

  it("host de aliados con puerto => true", () => {
    assert.strictEqual(isPartnerHost("aliados.micontexto.com:3000"), true);
  });

  it("case-insensitive => true", () => {
    assert.strictEqual(isPartnerHost("ALIADOS.micontexto.com"), true);
  });

  it("host de control => false", () => {
    assert.strictEqual(isPartnerHost("control.micontexto.com"), false);
  });

  it("localhost/dev sin subdominio => false (comportamiento actual)", () => {
    assert.strictEqual(isPartnerHost("localhost:3000"), false);
  });

  it("host nulo/ausente => false", () => {
    assert.strictEqual(isPartnerHost(null), false);
    assert.strictEqual(isPartnerHost(undefined), false);
  });
});

describe("resolveRootRedirect", () => {
  it("raíz en host aliados => /lab", () => {
    assert.strictEqual(resolveRootRedirect("aliados.micontexto.com"), "/lab");
  });

  it("raíz en host control => /admin", () => {
    assert.strictEqual(resolveRootRedirect("control.micontexto.com"), "/admin");
  });

  it("raíz en localhost => /admin (fallback host de control)", () => {
    assert.strictEqual(resolveRootRedirect("localhost:3000"), "/admin");
  });
});

describe("resolveAuthenticatedRedirect", () => {
  it("host aliados => /lab", () => {
    assert.strictEqual(resolveAuthenticatedRedirect("aliados.micontexto.com"), "/lab");
  });

  it("host control => /admin/users", () => {
    assert.strictEqual(resolveAuthenticatedRedirect("control.micontexto.com"), "/admin/users");
  });
});

describe("isBlockedOnPartnerHost", () => {
  it("prefijo de control (/admin) en host aliados => true (bloqueado)", () => {
    assert.strictEqual(isBlockedOnPartnerHost("aliados.micontexto.com", "/admin/users"), true);
  });

  it("prefijo /tenants en host aliados => true", () => {
    assert.strictEqual(isBlockedOnPartnerHost("aliados.micontexto.com", "/tenants"), true);
  });

  it("prefijo /settings en host aliados => true", () => {
    assert.strictEqual(isBlockedOnPartnerHost("aliados.micontexto.com", "/settings/general"), true);
  });

  it("prefijo /knowledge-ops en host aliados => true", () => {
    assert.strictEqual(isBlockedOnPartnerHost("aliados.micontexto.com", "/knowledge-ops"), true);
  });

  it("/lab en host aliados => false (no bloqueado)", () => {
    assert.strictEqual(isBlockedOnPartnerHost("aliados.micontexto.com", "/lab"), false);
  });

  it("prefijo de control en host de control => false", () => {
    assert.strictEqual(isBlockedOnPartnerHost("control.micontexto.com", "/admin/users"), false);
  });

  it("prefijo de control en localhost => false", () => {
    assert.strictEqual(isBlockedOnPartnerHost("localhost:3000", "/admin/users"), false);
  });
});

describe("sanitizeRedirectTo", () => {
  it("path interno válido y conocido => pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("/lab", "control.micontexto.com"), "/lab");
  });

  it("path interno válido con subruta => pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("/lab/onboarding", "aliados.micontexto.com"), "/lab/onboarding");
  });

  it("path interno de control conocido => pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("/admin/users", "control.micontexto.com"), "/admin/users");
  });

  it("protocol-relative //evil.com => NO pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("//evil.com", "control.micontexto.com"), null);
  });

  it("URL absoluta https://evil.com => NO pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("https://evil.com", "control.micontexto.com"), null);
  });

  it("URL absoluta embebida (/x?u=https://evil.com) contiene :// => NO pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("/redirect?u=https://evil.com", "control.micontexto.com"), null);
  });

  it("path sin slash inicial => NO pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("admin/users", "control.micontexto.com"), null);
  });

  it("path fuera de la allowlist de prefijos conocidos => NO pasa", () => {
    assert.strictEqual(sanitizeRedirectTo("/no-conocido", "control.micontexto.com"), null);
  });

  it("valor vacío/nulo => null", () => {
    assert.strictEqual(sanitizeRedirectTo(null, "control.micontexto.com"), null);
    assert.strictEqual(sanitizeRedirectTo("", "control.micontexto.com"), null);
  });
});
