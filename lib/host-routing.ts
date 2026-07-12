// lib/host-routing.ts
// G2-W6: lógica pura de enrutamiento por host para el cutover de dominios
// micontexto (control.micontexto.com vs aliados.micontexto.com) sobre el
// MISMO servicio Cloud Run. Se extrae de middleware.ts para poder testear
// sin depender de NextRequest.

/** Prefijos de rutas del panel de control (no deben verse desde el host de aliados). */
export const CONTROL_PREFIXES = ['/admin', '/tenants', '/settings', '/knowledge-ops'] as const;

/** Prefijos internos conocidos permitidos como destino de `redirectTo`. */
export const KNOWN_INTERNAL_PREFIXES = ['/admin', '/tenants', '/settings', '/knowledge-ops', '/lab'] as const;

/**
 * Determina si un header `Host` (p.ej. "aliados.micontexto.com" o
 * "aliados.micontexto.com:3000") corresponde al portal de aliados.
 * En localhost/dev sin subdominio (o host ausente) se comporta como host
 * de control (fallback seguro al comportamiento actual).
 */
export function isPartnerHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return host.toLowerCase().startsWith('aliados.');
}

/** A dónde debe redirigir la raíz `/` según el host. */
export function resolveRootRedirect(host: string | null | undefined): '/lab' | '/admin' {
  return isPartnerHost(host) ? '/lab' : '/admin';
}

/** A dónde debe redirigir un usuario ya autenticado que visita una ruta de auth. */
export function resolveAuthenticatedRedirect(host: string | null | undefined): '/lab' | '/admin/users' {
  return isPartnerHost(host) ? '/lab' : '/admin/users';
}

/**
 * true si, dado el host, el pathname pertenece a un prefijo del panel de
 * control y por tanto debe bloquearse en el host de aliados.
 */
export function isBlockedOnPartnerHost(host: string | null | undefined, pathname: string): boolean {
  if (!isPartnerHost(host)) return false;
  return CONTROL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Sanea un valor de `redirectTo` recibido por querystring: solo se acepta
 * si es un path interno (empieza con "/", no con "//") y no contiene un
 * esquema ("://"), lo que descarta URLs absolutas o protocol-relative que
 * apunten a hosts externos (p.ej. "//evil.com" o "https://evil.com").
 * Además se restringe a los prefijos internos conocidos.
 * Devuelve el path saneado, o null si no pasa la allowlist (en cuyo caso el
 * llamador debe usar su propio fallback según el host).
 */
export function sanitizeRedirectTo(
  value: string | null | undefined,
  _host?: string | null
): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;

  const isKnownPrefix = KNOWN_INTERNAL_PREFIXES.some(
    (prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`)
  );
  if (!isKnownPrefix) return null;

  return value;
}
