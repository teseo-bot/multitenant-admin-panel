// @vitest-environment node
//
// ADR-212 D1. El defecto que este módulo arregla es SILENCIOSO: `inviteAndProvision` creaba la
// identidad en el IdP de `micontexto-control` y devolvía éxito, pero el usuario no podía entrar
// al panel de su tenant porque los tokens de Firebase son POR PROYECTO. Medido el 2026-08-05:
// monica.galan@fleetco.mx existía en control (sin contraseña, sin claims) y NO en tenant1.
//
// Los tests que importan son los que fijan las dos propiedades que, si se rompen, vuelven a
// fallar sin ruido:
//   1. sin mapa se cae al IdP de control (fallback deliberado — sin él, desplegar esto rompe
//      el alta de todo tenant no migrado),
//   2. con mapa, la app de firebase va NOMBRADA por proyecto. Una app sin nombre pisa la app
//      por defecto del panel y todo el alta vuelve a acabar en control, esta vez en silencio.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const apps: Array<{ name: string; options: Record<string, unknown> }> = [];
  return {
    apps,
    initializeApp: vi.fn((options: Record<string, unknown>, name?: string) => {
      // Firebase real LANZA si se re-inicializa un nombre ya existente. Se replica: si el
      // cacheo del módulo se rompiera, la segunda invitación del mismo tenant fallaría.
      if (apps.some((a) => a.name === (name ?? '[DEFAULT]'))) {
        throw new Error(`app named ${name ?? '[DEFAULT]'} already exists`);
      }
      const app = { name: name ?? '[DEFAULT]', options };
      apps.push(app);
      return app;
    }),
    getApp: vi.fn((name: string) => apps.find((a) => a.name === name)),
    getApps: vi.fn(() => apps),
    applicationDefault: vi.fn(() => ({ tipo: 'adc' })),
    getAuth: vi.fn((app: { name: string }) => ({ __app: app.name })),
    adminAuth: vi.fn(() => ({ __app: 'IDP-DE-CONTROL' })),
    query: vi.fn(),
  };
});

vi.mock('firebase-admin/app', () => ({
  initializeApp: h.initializeApp,
  getApp: h.getApp,
  getApps: h.getApps,
  applicationDefault: h.applicationDefault,
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: h.getAuth }));
vi.mock('@/lib/gcp-auth/admin', () => ({ adminAuth: h.adminAuth }));
vi.mock('@/lib/db', () => ({ pool: { query: h.query } }));

import { getTenantIdpMap, authForTenantProject } from './tenant-idp';

const COMERSEG = '00000000-0000-0000-0000-000000000001';

/** Lo que devolvería la consulta al plano de control para ese tenant. */
function conMapa(idp_project_id: string | null, idp_tenant_id: string | null = null) {
  h.query.mockResolvedValue({ rows: [{ idp_project_id, idp_tenant_id }] });
}

beforeEach(() => {
  h.apps.length = 0;
  vi.clearAllMocks();
});

describe('getTenantIdpMap', () => {
  it('devuelve el proyecto mapeado', async () => {
    conMapa('micontexto-tenant1');
    expect(await getTenantIdpMap(COMERSEG)).toEqual({
      idpProjectId: 'micontexto-tenant1',
      idpTenantId: null,
    });
  });

  it('tenant sin mapa: ambos null (no lanza)', async () => {
    conMapa(null, null);
    expect(await getTenantIdpMap('otro')).toEqual({ idpProjectId: null, idpTenantId: null });
  });

  it('tenant inexistente: null, no reventar — el fallback lo resuelve arriba', async () => {
    h.query.mockResolvedValue({ rows: [] });
    expect(await getTenantIdpMap('no-existe')).toEqual({ idpProjectId: null, idpTenantId: null });
  });

  it('devuelve también idp_tenant_id cuando el tenant usa multi-tenancy de GCIP', async () => {
    conMapa('micontexto-tenant1', 'sub-tenant-abc');
    expect(await getTenantIdpMap(COMERSEG)).toEqual({
      idpProjectId: 'micontexto-tenant1',
      idpTenantId: 'sub-tenant-abc',
    });
  });
});

describe('authForTenantProject', () => {
  it('SIN mapa cae al IdP de control — el fallback que exige ADR-212 D1', async () => {
    conMapa(null);
    const r = await authForTenantProject('tenant-sin-migrar');

    expect(r.esDelTenant).toBe(false);
    expect(r.idpProjectId).toBeNull();
    expect(h.adminAuth).toHaveBeenCalledTimes(1);
    expect(h.initializeApp).not.toHaveBeenCalled();
  });

  it('CON mapa usa el IdP del tenant, no el de control', async () => {
    conMapa('micontexto-tenant1');
    const r = await authForTenantProject(COMERSEG);

    expect(r.esDelTenant).toBe(true);
    expect(r.idpProjectId).toBe('micontexto-tenant1');
    expect(h.adminAuth).not.toHaveBeenCalled();
    expect(h.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'micontexto-tenant1' }),
      expect.any(String)
    );
  });

  it('la app va NOMBRADA: sin nombre pisaría la app por defecto y el alta volvería a control', async () => {
    conMapa('micontexto-tenant1');
    await authForTenantProject(COMERSEG);

    const [, nombre] = h.initializeApp.mock.calls[0];
    expect(nombre).toBeTruthy();
    expect(nombre).not.toBe('[DEFAULT]');
    expect(nombre).toContain('micontexto-tenant1');
  });

  it('dos altas del mismo tenant reutilizan la app: initializeApp una sola vez', async () => {
    conMapa('micontexto-tenant1');
    await authForTenantProject(COMERSEG);
    await authForTenantProject(COMERSEG);

    // Sin cacheo, el mock de firebase lanza «already exists» — igual que el real.
    expect(h.initializeApp).toHaveBeenCalledTimes(1);
    expect(h.getApp).toHaveBeenCalledTimes(1);
  });

  it('dos tenants distintos obtienen apps distintas — no se contaminan entre sí', async () => {
    conMapa('micontexto-tenant1');
    const a = await authForTenantProject(COMERSEG);
    conMapa('micontexto-tenant2');
    const b = await authForTenantProject('tenant-2');

    expect(h.initializeApp).toHaveBeenCalledTimes(2);
    expect(h.apps.map((x) => x.name)).toEqual([
      'tenant-idp-micontexto-tenant1',
      'tenant-idp-micontexto-tenant2',
    ]);
    expect(a.auth).not.toEqual(b.auth);
  });

  it('la credencial es ADC: no se inventan claves por tenant', async () => {
    conMapa('micontexto-tenant1');
    await authForTenantProject(COMERSEG);
    expect(h.applicationDefault).toHaveBeenCalled();
  });
});
