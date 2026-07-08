// lib/partners/session.ts
// KL1-W1: guard de sesión para el Knowledge Lab de aliados.
//
// Espeja lib/auth/get-tenant-context.ts (claim tenant_id) y lib/auth/guards.ts
// (forma GuardResult/redirect): la sesión se valida vía cookie __session
// (Identity Platform, lib/gcp-auth/session.ts); el custom claim `partner_id`
// acota la búsqueda pero NUNCA decide por sí solo — la fila real en
// `partner_members` manda (RP-KL7). Claim presente sin fila real => rechazo.
//
// Los tres límites de I/O (leer la cookie, verificar la sesión con Identity
// Platform, consultar la BD) están inyectados con defaults reales para que el
// llamador normal (`requirePartnerMember(minRole)`) no cambie, pero los tests
// unitarios puedan sustituirlos sin mockear `next/headers` (cookies() explota
// fuera de un request scope real de Next) ni firebase-admin.

import { cookies } from "next/headers";
import { verifySession as verifySessionDefault, SESSION_COOKIE } from "@/lib/gcp-auth/session";
import { pool } from "@/lib/db";

export type PartnerMemberRole = "member" | "curator";

export interface PartnerSummary {
  id: string;
  slug: string;
  legal_name: string;
  status: string;
}

export type PartnerGuardOk = {
  ok: true;
  partner: PartnerSummary;
  member_role: PartnerMemberRole;
  uid: string;
  onboarded_at?: string | null;
};

export type PartnerGuardFail = {
  ok: false;
  status: 401 | 403;
  error: string;
};

export type PartnerGuardResult = PartnerGuardOk | PartnerGuardFail;

type DecodedSession = { uid: string; partner_id?: string };

export interface RequirePartnerMemberDeps {
  /** Por defecto: lee la cookie __session vía next/headers. */
  getSessionCookieValue?: () => Promise<string | undefined>;
  /** Por defecto: lib/gcp-auth/session.verifySession. */
  verifySession?: (cookieValue: string) => Promise<DecodedSession | null>;
  /** Por defecto: pool.query. */
  query?: (text: string, params: unknown[]) => Promise<{ rows: any[] }>;
}

async function defaultGetSessionCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

/**
 * Exige membresía de aliado (member o curator) sobre la cookie de sesión actual.
 *
 * - Sin cookie / cookie inválida => 401.
 * - Cookie válida pero sin fila en `partner_members` para ese uid (con el `partner_id`
 *   del claim si viene, o por uid solo si no viene) => 403 (RP-KL7: el claim acelera,
 *   la BD manda).
 * - `minRole:'curator'` exige member_role === 'curator'; un 'member' => 403.
 *
 * `deps` es solo para tests (inyecta lectura de cookie / verificación de sesión /
 * query); en producción se usan siempre los defaults reales.
 */
export async function requirePartnerMember(
  minRole?: "curator",
  deps: RequirePartnerMemberDeps = {}
): Promise<PartnerGuardResult> {
  const getSessionCookieValue = deps.getSessionCookieValue ?? defaultGetSessionCookieValue;
  const verify = deps.verifySession ?? verifySessionDefault;
  const query = deps.query ?? ((text: string, params: unknown[]) => pool.query(text, params));

  const sessionCookie = await getSessionCookieValue();
  if (!sessionCookie) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const decoded = await verify(sessionCookie);
  if (!decoded) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const uid = decoded.uid;
  const claimPartnerId = decoded.partner_id;

  // El claim acelera la búsqueda (acota por partner_id); si no viene, se busca por
  // uid solo. En ambos casos la fila real de partner_members es la que decide.
  const { rows } = claimPartnerId
    ? await query(
        `SELECT pm.partner_id, pm.member_role, pm.onboarded_at, p.slug, p.legal_name, p.status
           FROM partner_members pm
           JOIN partners p ON p.id = pm.partner_id
          WHERE pm.partner_id = $1 AND pm.user_id = $2
          LIMIT 1`,
        [claimPartnerId, uid]
      )
    : await query(
        `SELECT pm.partner_id, pm.member_role, pm.onboarded_at, p.slug, p.legal_name, p.status
           FROM partner_members pm
           JOIN partners p ON p.id = pm.partner_id
          WHERE pm.user_id = $1
          LIMIT 1`,
        [uid]
      );

  const row = rows[0];
  if (!row) {
    return { ok: false, status: 403, error: "No pertenece a ningún aliado" };
  }

  // Aliado offboarded no entra al Lab (suspended SÍ entra para ver sus contratos)
  const partnerStatus = row.status;
  if (partnerStatus === "offboarded") {
    return { ok: false, status: 403, error: "Aliado dado de baja" };
  }

  const memberRole = row.member_role as PartnerMemberRole;
  if (minRole === "curator" && memberRole !== "curator") {
    return { ok: false, status: 403, error: "Requiere rol curator" };
  }

  return {
    ok: true,
    uid,
    member_role: memberRole,
    onboarded_at: row.onboarded_at ?? null,
    partner: {
      id: row.partner_id,
      slug: row.slug,
      legal_name: row.legal_name,
      status: partnerStatus,
    },
  };
}
