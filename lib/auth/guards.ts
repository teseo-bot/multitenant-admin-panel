// lib/auth/guards.ts
// WU-08 (E0/E3) · G1-W3: Autorización centralizada sobre Identity Platform.
// El privilegio de plataforma es EXPLÍCITO: custom claim platform_admin === true.
// Nunca se decide acceso por email ni por ausencia de membresía.

import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/gcp-auth/session";
import { resolveAccess, type Role } from "@/lib/services/membership";

/** Usuario autenticado (forma mínima que consumen los guards y callers). */
export type AuthUser = { id: string; email: string | null; platformAdmin: boolean };

export type GuardOk = { ok: true; user: AuthUser };
export type GuardFail = { ok: false; status: 401 | 403; error: string };
export type GuardResult = GuardOk | GuardFail;

/** Usuario autenticado actual (server-side) desde la cookie de sesión, o null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  const decoded = await verifySession(sessionCookie);
  if (!decoded) return null;
  return {
    id: decoded.uid,
    email: decoded.email ?? null,
    platformAdmin: decoded.platform_admin === true,
  };
}

/** Platform admin = custom claim explícito. NUNCA por email. */
export function isPlatformAdmin(user: AuthUser | null): boolean {
  return user?.platformAdmin === true;
}

/** Exige Platform Admin (operador de plataforma / Teseo). */
export async function requirePlatformAdmin(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "No autorizado" };
  if (!isPlatformAdmin(user)) {
    return { ok: false, status: 403, error: "Requiere privilegio de Platform Admin" };
  }
  return { ok: true, user };
}

/**
 * Exige rol OWNER/ADMIN en el tenant indicado (o Platform Admin, que pasa siempre).
 * Usa resolveAccess (WU-05) como única fuente de verdad de roles.
 */
export async function requireTenantAdmin(
  tenantId: string
): Promise<GuardResult & { role?: Role }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "No autorizado" };
  if (isPlatformAdmin(user)) return { ok: true, user };

  const { role } = await resolveAccess(user.id, tenantId);
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, status: 403, error: "Requiere rol de administrador del tenant" };
  }
  return { ok: true, user, role };
}
