// lib/tenants/tenant-idp.ts — ADR-212 D1
//
// Puente hacia el Identity Platform DEL TENANT, que no es el de este panel.
//
// El problema que resuelve, medido en vivo el 2026-08-05: `inviteAndProvision` usaba
// `adminAuth()`, que resuelve `applicationDefault()` SIN projectId ⇒ crea la identidad en el
// IdP de `micontexto-control`. Pero `comerseg.fleetco.mx` autentica contra el IdP de
// `micontexto-tenant1`, y los tokens de Firebase son POR PROYECTO. Resultado verificado con
// accounts:lookup: monica.galan@fleetco.mx existía en control (sin contraseña, sin claims) y
// NO existía en tenant1 ⇒ la invitación no daba acceso a nada.
//
// Es el mismo puente que `lib/partners/aliados-idp.ts` ya hace para el portal de aliados, que
// funciona en producción. La única diferencia: aquí es a NIVEL PROYECTO (`getAuth(app)`), sin
// `tenantManager().authForTenant()`, porque comerseg usa el IdP del proyecto directamente y no
// multi-tenancy de GCIP. Por eso `idp_tenant_id` existe en el mapa pero hoy va NULL.
//
// Requisito de despliegue: la SA de runtime de este panel
// (`panel-runtime@micontexto-control`) necesita permiso de Identity Platform sobre el proyecto
// del tenant. El ADR deja el binding escrito y lo corre el CEO.

import { initializeApp, getApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { adminAuth } from '@/lib/gcp-auth/admin';
import { pool } from '@/lib/db';

export interface TenantIdpMap {
  idpProjectId: string | null;
  idpTenantId: string | null;
}

/**
 * Resuelve a qué IdP pertenece un tenant. Nulo ⇒ el tenant no está migrado y se usa el IdP de
 * control, que es el comportamiento anterior. El fallback es deliberado (ADR-212 D1): sin él,
 * desplegar esto rompería el alta de cualquier tenant que todavía no tenga el mapa puesto.
 */
export async function getTenantIdpMap(tenantId: string): Promise<TenantIdpMap> {
  const { rows } = await pool.query(
    'SELECT idp_project_id, idp_tenant_id FROM tenants WHERE id = $1 LIMIT 1',
    [tenantId]
  );
  return {
    idpProjectId: rows[0]?.idp_project_id ?? null,
    idpTenantId: rows[0]?.idp_tenant_id ?? null,
  };
}

/**
 * Auth apuntando al IdP del proyecto indicado. La app se nombra por proyecto y se cachea: sin
 * nombrarla se pisaría la app por defecto que este panel usa para SU propio proyecto, y todo
 * el alta acabaría otra vez en control — el bug que esto arregla, pero silencioso.
 */
function authForProject(projectId: string): Auth {
  const appName = `tenant-idp-${projectId}`;
  const app = getApps().some((a) => a.name === appName)
    ? getApp(appName)
    : initializeApp({ credential: applicationDefault(), projectId }, appName);
  return getAuth(app);
}

/**
 * El Auth que hay que usar para provisionar a un usuario de este tenant.
 *
 * Devuelve también `esDelTenant` para que quien llama sepa si la identidad quedó en el IdP del
 * tenant o cayó al de control — eso decide, entre otras cosas, a qué dominio apunta el enlace
 * de contraseña. Nunca se adivina más abajo.
 */
export async function authForTenantProject(
  tenantId: string
): Promise<{ auth: Auth; esDelTenant: boolean; idpProjectId: string | null }> {
  const { idpProjectId } = await getTenantIdpMap(tenantId);
  if (!idpProjectId) {
    return { auth: adminAuth(), esDelTenant: false, idpProjectId: null };
  }
  return { auth: authForProject(idpProjectId), esDelTenant: true, idpProjectId };
}
