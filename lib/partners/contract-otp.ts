// lib/partners/contract-otp.ts
// PA4-W2 — firma simple por OTP de contrato de aliado. LÓGICA PURA (sin BD, sin red).
// Reloj inyectado (`now`): nada de Date.now() dentro de la lógica pura, para que
// __tests__/lib/partners/contract-otp.test.ts controle el tiempo exactamente.
//
// Persistencia real: migrations-gcp/010_partner_contract_otp.sql (tabla
// partner_contract_otp, una fila por (contract_id, signer_role)). Las rutas
// (app/api/partners/me/contracts/[id]/sign, app/api/admin/partners/contracts/[id]/sign)
// leen/escriben esa fila y delegan TODA la decisión a `verifyOtp`.

import { randomInt, createHash } from "node:crypto";

/** TTL del código: 10 minutos. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Intentos fallidos permitidos antes de bloquear. */
export const MAX_ATTEMPTS = 3;

/** Duración del bloqueo tras agotar los intentos: 15 minutos. */
export const LOCK_MS = 15 * 60 * 1000;

/** Estado persistido del challenge OTP (timestamps epoch ms, no Date). */
export interface OtpChallenge {
  code_hash: string;
  expires_at: number;
  attempts: number;
  locked_until: number | null;
}

export type OtpVerifyResult = "ok" | "wrong" | "expired" | "locked";

export interface OtpVerifyOutcome {
  result: OtpVerifyResult;
  next: OtpChallenge;
}

/** Genera un código de 6 dígitos, con ceros a la izquierda si aplica (rango 000000-999999). */
export function generateOtp(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/** sha256 hex del código. El código en claro NUNCA se persiste. */
export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Verifica un código contra el challenge vigente, con reloj `now` inyectado.
 *
 * Orden de las comprobaciones (importa para el caso "bloqueo vencido pero código
 * también vencido"):
 *   1. `now < locked_until` → 'locked', SIN consumir intento (challenge sin cambios).
 *   2. `now > expires_at` → 'expired' (challenge sin cambios).
 *   3. hash coincide → 'ok' (challenge sin cambios; el caller borra/reemplaza la fila).
 *   4. hash no coincide → 'wrong', attempts+1; si con eso attempts llega a
 *      MAX_ATTEMPTS, se fija `locked_until = now + LOCK_MS` (los siguientes intentos,
 *      mientras `now < locked_until`, resuelven en el paso 1 como 'locked').
 */
export function verifyOtp(challenge: OtpChallenge, code: string, now: number): OtpVerifyOutcome {
  if (challenge.locked_until !== null && now < challenge.locked_until) {
    return { result: "locked", next: challenge };
  }

  if (now > challenge.expires_at) {
    return { result: "expired", next: challenge };
  }

  const hash = hashOtp(code);
  if (hash === challenge.code_hash) {
    return { result: "ok", next: challenge };
  }

  const attempts = challenge.attempts + 1;
  const locked_until = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : challenge.locked_until;
  const next: OtpChallenge = { ...challenge, attempts, locked_until };
  return { result: "wrong", next };
}
