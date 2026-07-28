// lib/partners/aliados-idp.ts
// Puente hacia el pool de identidad de los ALIADOS, que NO es el de este panel.
//
// El portal de aliados autentica contra un tenant de GCIP (`Aliados-*`) que vive
// en OTRO proyecto (`micontexto-aliados`), mientras este panel corre en
// `micontexto-control` con su propio Identity Platform. Por eso `adminAuth()`
// (lib/gcp-auth/admin.ts) NO sirve aquí: resolvería uids del proyecto equivocado
// y crearía miembros que el portal jamás podrá autenticar.
//
// Requisitos de despliegue (si faltan, todo esto degrada a "captura el uid a
// mano" en vez de romper):
//   - ALIADOS_IDP_PROJECT_ID  p.ej. micontexto-aliados
//   - ALIADOS_IDP_TENANT_ID   p.ej. Aliados-teq7e
//   - la SA de runtime de este panel con permiso de Identity Platform sobre ese
//     proyecto (roles/identityplatform.admin o firebaseauth.admin).

import { initializeApp, getApp, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth, type TenantAwareAuth } from "firebase-admin/auth";

const ALIADOS_APP_NAME = "aliados-idp";

export const ALIADOS_IDP_PROJECT_ID = process.env.ALIADOS_IDP_PROJECT_ID;
export const ALIADOS_IDP_TENANT_ID = process.env.ALIADOS_IDP_TENANT_ID;

/** ¿Está cableado el puente? Si no, el alta exige uid explícito. */
export function aliadosIdpConfigured(): boolean {
  return Boolean(ALIADOS_IDP_PROJECT_ID && ALIADOS_IDP_TENANT_ID);
}

/**
 * Auth scopeado al tenant de aliados. App nombrada aparte para no pisar la app
 * por defecto que usa el resto del panel para SU propio proyecto.
 */
export function aliadosAuth(): TenantAwareAuth {
  if (!aliadosIdpConfigured()) {
    throw new Error(
      "Identity Platform de aliados no configurado: faltan ALIADOS_IDP_PROJECT_ID y/o ALIADOS_IDP_TENANT_ID"
    );
  }

  const app = getApps().some((a) => a.name === ALIADOS_APP_NAME)
    ? getApp(ALIADOS_APP_NAME)
    : initializeApp(
        { credential: applicationDefault(), projectId: ALIADOS_IDP_PROJECT_ID },
        ALIADOS_APP_NAME
      );

  return getAuth(app).tenantManager().authForTenant(ALIADOS_IDP_TENANT_ID!);
}

export interface ResolvedAliadoUser {
  uid: string;
  email: string | null;
  /** true si esta llamada lo creó (el admin debe enviarle el enlace de acceso). */
  created: boolean;
}

/**
 * Resuelve el uid de un correo dentro del tenant de aliados; opcionalmente lo
 * crea si no existe.
 *
 * No fijamos contraseña: el usuario entra por el flujo de recuperación del
 * portal. Así este panel nunca maneja credenciales de un aliado.
 */
export async function resolveAliadoUserByEmail(
  email: string,
  createIfMissing: boolean
): Promise<ResolvedAliadoUser> {
  const auth = aliadosAuth();

  try {
    const user = await auth.getUserByEmail(email);
    return { uid: user.uid, email: user.email ?? null, created: false };
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") throw err;
    if (!createIfMissing) {
      const notFound = new Error(
        `No existe una cuenta con ${email} en el pool de aliados. Marca "crear la cuenta" para darla de alta.`
      );
      (notFound as any).status = 404;
      throw notFound;
    }
  }

  const created = await auth.createUser({ email, emailVerified: false });
  return { uid: created.uid, email: created.email ?? null, created: true };
}

/** Enlace de establecimiento de contraseña para enviarle al aliado. */
export async function buildPasswordSetupLink(email: string, portalUrl?: string): Promise<string> {
  const auth = aliadosAuth();
  const url = portalUrl ?? process.env.ALIADOS_PORTAL_URL;
  return auth.generatePasswordResetLink(
    email,
    url ? { url: `${url.replace(/\/$/, "")}/auth/login` } : undefined
  );
}
