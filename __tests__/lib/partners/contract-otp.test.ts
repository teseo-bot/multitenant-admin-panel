// __tests__/lib/partners/contract-otp.test.ts
// PA4-W2: tests unitarios del módulo OTP puro de firma de contratos (sin BD).
// Patrón: __tests__/lib/partners/contract-state-machine.test.ts. Reloj inyectado (`now`)
// en cada llamada — nunca Date.now().

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  LOCK_MS,
  type OtpChallenge,
} from "../../../lib/partners/contract-otp";

const T0 = 1_000_000_000_000; // ancla arbitraria de reloj

function makeChallenge(code: string, overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    code_hash: hashOtp(code),
    expires_at: T0 + OTP_TTL_MS,
    attempts: 0,
    locked_until: null,
    ...overrides,
  };
}

describe("generateOtp", () => {
  it("siempre produce un string de 6 dígitos (con ceros a la izquierda si aplica)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtp();
      assert.strictEqual(code.length, 6, `código '${code}' no tiene longitud 6`);
      assert.match(code, /^\d{6}$/, `código '${code}' no es numérico de 6 dígitos`);
    }
  });
});

describe("hashOtp", () => {
  it("es estable (mismo input => mismo hash) y determinista/sha256-hex", () => {
    const h1 = hashOtp("123456");
    const h2 = hashOtp("123456");
    assert.strictEqual(h1, h2);
    assert.match(h1, /^[0-9a-f]{64}$/, "debe ser hex de 64 chars (sha256)");
  });

  it("códigos distintos producen hashes distintos", () => {
    assert.notStrictEqual(hashOtp("123456"), hashOtp("654321"));
  });
});

describe("verifyOtp", () => {
  it("código correcto dentro del TTL => 'ok'", () => {
    const challenge = makeChallenge("123456");
    const outcome = verifyOtp(challenge, "123456", T0 + 1000);
    assert.strictEqual(outcome.result, "ok");
  });

  it("código incorrecto 3 veces: el 3º deja 'wrong' con lock; el 4º intento (aun con código correcto) => 'locked'", () => {
    let challenge = makeChallenge("123456");

    const r1 = verifyOtp(challenge, "000000", T0);
    assert.strictEqual(r1.result, "wrong");
    assert.strictEqual(r1.next.attempts, 1);
    assert.strictEqual(r1.next.locked_until, null);
    challenge = r1.next;

    const r2 = verifyOtp(challenge, "000000", T0 + 1000);
    assert.strictEqual(r2.result, "wrong");
    assert.strictEqual(r2.next.attempts, 2);
    assert.strictEqual(r2.next.locked_until, null);
    challenge = r2.next;

    const r3 = verifyOtp(challenge, "000000", T0 + 2000);
    assert.strictEqual(r3.result, "wrong");
    assert.strictEqual(r3.next.attempts, 3);
    assert.strictEqual(r3.next.attempts, MAX_ATTEMPTS);
    assert.strictEqual(r3.next.locked_until, T0 + 2000 + LOCK_MS);
    challenge = r3.next;

    // 4º intento, con el código CORRECTO, todavía dentro de la ventana de lock => 'locked'.
    const r4 = verifyOtp(challenge, "123456", T0 + 2000 + 1000);
    assert.strictEqual(r4.result, "locked");
    // No consume intento.
    assert.strictEqual(r4.next.attempts, 3);

    // Pasado el lock (now >= locked_until) pero también pasado expires_at => 'expired',
    // no 'ok' ni 'wrong', aunque el código sea correcto.
    const afterLock = challenge.locked_until! + 1;
    assert.ok(afterLock > challenge.expires_at, "el escenario de test asume TTL < LOCK_MS");
    const r5 = verifyOtp(challenge, "123456", afterLock);
    assert.strictEqual(r5.result, "expired");
  });

  it("código expirado (now > expires_at) => 'expired'", () => {
    const challenge = makeChallenge("123456");
    const outcome = verifyOtp(challenge, "123456", challenge.expires_at + 1);
    assert.strictEqual(outcome.result, "expired");
  });

  it("locked_until vigente bloquea incluso antes de llegar a MAX_ATTEMPTS si ya estaba fijado", () => {
    const challenge = makeChallenge("123456", { locked_until: T0 + 5000, attempts: 1 });
    const outcome = verifyOtp(challenge, "123456", T0 + 4000);
    assert.strictEqual(outcome.result, "locked");
    assert.strictEqual(outcome.next.attempts, 1, "no debe consumir intento estando bloqueado");
  });

  it("locked_until en el pasado (now >= locked_until) ya no bloquea: sigue el flujo normal", () => {
    const challenge = makeChallenge("123456", { locked_until: T0 - 1, attempts: 2 });
    const outcome = verifyOtp(challenge, "123456", T0 + 1000);
    assert.strictEqual(outcome.result, "ok");
  });
});
