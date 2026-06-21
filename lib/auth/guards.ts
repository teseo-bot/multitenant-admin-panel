// lib/auth/guards.ts
// WU-08 (E0/E3): Autorización centralizada. Reemplaza los checks por email literal.
// El privilegio de plataforma es EXPLÍCITO: auth.users.app_metadata.platform_admin === true.
// Nunca se decide acceso por email ni por ausencia de membresía.

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { resolveAccess, type Role } from "@/lib/services/membership";

export type GuardOk = { ok: true; user: User };
export type GuardFail = { ok: false; status: 401 | 403; error: string };
export type GuardResult = GuardOk | GuardFail;

/** Usuario autenticado actual (server-side), o null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** Platform admin = flag explícito en app_metadata. NUNCA por email. */
export function isPlatformAdmin(user: User | null): boolean {
  return user?.app_metadata?.platform_admin === true;
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
