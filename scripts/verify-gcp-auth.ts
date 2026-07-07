// WU G1-W1 verificación: adapter de auth GCP (firebase-admin + session cookies).
// Corre con: npx tsx scripts/verify-gcp-auth.ts
// Mockea firebase-admin para evitar dependencia en credenciales reales de GCP.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

let pass = 0, fail = 0;
function assert(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.error("  ✗", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

// Mock firebase-admin
const mockAuth = {
  createSessionCookie: async (idToken: string, options: { expiresIn: number }) => {
    if (idToken === "valid-token") {
      return "mock-session-cookie-value";
    }
    throw new Error("Invalid token");
  },
  verifySessionCookie: async (cookieValue: string, checkRevoked: boolean) => {
    if (cookieValue === "mock-session-cookie-value") {
      return { uid: "test-user-123", email: "test@example.com" };
    }
    throw new Error("Invalid session");
  },
  revokeRefreshTokens: async (uid: string) => {
    // No-op in mock
  },
};

const mockFirebaseAdmin = {
  initializeApp: () => ({ name: '[DEFAULT]' }),
  getApps: () => [{ name: '[DEFAULT]' }], // Pretend one app is already initialized
  cert: () => ({}),
  applicationDefault: () => ({}),
  getAuth: () => mockAuth,
};

// Inject mock into require cache BEFORE importing our modules
// @ts-ignore - TS doesn't like require.cache manipulation, but it works at runtime
require.cache[require.resolve('firebase-admin/app')] = {
  exports: mockFirebaseAdmin,
};
// @ts-ignore
require.cache[require.resolve('firebase-admin/auth')] = {
  exports: { getAuth: () => mockAuth },
};

(async () => {
  try {
    // Import our session module (will use mocked firebase-admin)
    const { createSession, verifySession, destroySession, SESSION_COOKIE } =
      await import("@/lib/gcp-auth/session");

    // Test 1: POST idToken válido → produce Set-Cookie con los flags correctos
    console.log("\n1. Testing createSession with valid idToken...");
    const sessionCookie = await createSession("valid-token");
    assert("createSession returns cookie string", typeof sessionCookie === "string", typeof sessionCookie);
    assert("cookie is non-empty", sessionCookie.length > 0, sessionCookie.length);

    // Test 2: verifySession con cookie válida retorna datos decodificados
    console.log("\n2. Testing verifySession with valid cookie...");
    const decoded = await verifySession(sessionCookie);
    assert("verifySession returns DecodedIdToken", decoded !== null && decoded.uid === "test-user-123", decoded);

    // Test 3: verifySession con cookie inválida retorna null (no throw)
    console.log("\n3. Testing verifySession with invalid cookie...");
    const invalidDecoded = await verifySession("invalid-cookie");
    assert("verifySession returns null on invalid cookie", invalidDecoded === null, invalidDecoded);

    // Test 4: idToken inválido en createSession → throw
    console.log("\n4. Testing createSession with invalid idToken...");
    try {
      await createSession("invalid-token");
      assert("createSession throws on invalid token", false, "should have thrown");
    } catch (err) {
      assert("createSession throws on invalid token", true);
    }

    // Test 5: destroySession ejecuta sin error
    console.log("\n5. Testing destroySession...");
    try {
      await destroySession("test-user-123");
      assert("destroySession succeeds", true);
    } catch (err) {
      assert("destroySession succeeds", false, err);
    }

    // Test 6: SESSION_COOKIE constant is correct
    console.log("\n6. Testing SESSION_COOKIE constant...");
    assert("SESSION_COOKIE === '__session'", SESSION_COOKIE === "__session", SESSION_COOKIE);

    // Test 7: Verify route.ts exports (static structure check)
    console.log("\n7. Testing route.ts structure...");
    const route = await import("@/app/api/auth/session/route");
    assert("route.ts exports POST", typeof route.POST === "function", typeof route.POST);
    assert("route.ts exports DELETE", typeof route.DELETE === "function", typeof route.DELETE);
    assert("route.ts has dynamic='force-dynamic'", route.dynamic === "force-dynamic", route.dynamic);

    // Test 8: Verify middleware exports and matcher
    console.log("\n8. Testing middleware structure...");
    const middlewareModule = await import("@/middleware");
    assert("middleware exports middleware function", typeof middlewareModule.middleware === "function", typeof middlewareModule.middleware);
    assert("middleware has config with matcher", Array.isArray(middlewareModule.config?.matcher), middlewareModule.config?.matcher);

    // Test 9: Verify client Firebase auth export
    console.log("\n9. Testing client Firebase auth...");
    const clientAuth = await import("@/lib/gcp-auth/client");
    assert("client exports getAuth", typeof clientAuth.getAuth === "function", typeof clientAuth.getAuth);

  } catch (err) {
    console.error("FATAL:", err);
    process.exit(1);
  }

  console.log(`\nWU G1-W1 GCP Auth: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
