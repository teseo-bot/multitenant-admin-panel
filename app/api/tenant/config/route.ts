import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@/lib/validators/user';
import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

// Sin fila en tenant_configs no hay branding: null significa «usa el sistema de
// diseño del producto» (app/globals.css). Un color literal aquí lo inyecta
// <TenantThemeStyle /> como <style> en runtime y pisa la paleta base.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await pool.connect();
    try {
      // Get tenant_users and tenant info
      const tuRes = await client.query(
        `SELECT tu.tenant_id, tu.role, t.id, t.name, t.domain
         FROM tenant_users tu
         LEFT JOIN tenants t ON tu.tenant_id = t.id
         WHERE tu.user_id = $1
         LIMIT 1`,
        [user.id]
      );

      const tenantUser = tuRes.rows[0];

      if (!tenantUser) {
        // Fallback graceful para Global Admins sin tenant_user o usuarios huerfanos,
        // evitando el error 404 (Not Found) en producción que rompía el useTenantTheme.
        return NextResponse.json({
          organization: { id: 'platform', name: 'Teseo Platform', domain: 'teseo.lat' },
          role: 'platform_admin',
          branding: {
            primaryColor: null,
            accentColor: null,
            logoUrl: null,
            themeMode: 'SYSTEM'
          }
        });
      }

      // Get tenant config
      const configRes = await client.query(
        `SELECT primary_color, accent_color, logo_url, theme_mode
         FROM tenant_configs
         WHERE tenant_id = $1`,
        [tenantUser.tenant_id]
      );

      const config = configRes.rows[0];
      const branding = config ? {
        primaryColor: config.primary_color,
        accentColor: config.accent_color,
        logoUrl: config.logo_url,
        themeMode: config.theme_mode
      } : {
        primaryColor: null,
        accentColor: null,
        logoUrl: null,
        themeMode: 'SYSTEM'
      };

      return NextResponse.json({
        organization: { id: tenantUser.id, name: tenantUser.name, domain: tenantUser.domain },
        role: tenantUser.role,
        branding
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err?.digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    logger.error("api.tenant.config.error", { error: String(err) });
    return NextResponse.json({
      organization: null,
      role: 'MEMBER',
      branding: {
        primaryColor: null,
        accentColor: null,
        logoUrl: null,
        themeMode: 'SYSTEM'
      }
    });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = await pool.connect();
  try {
    // Get tenant_users and role
    const tuRes = await client.query(
      `SELECT tenant_id, role FROM tenant_users WHERE user_id = $1 LIMIT 1`,
      [user.id]
    );

    const tenantUser = tuRes.rows[0];
    if (!tenantUser) {
      return NextResponse.json({ error: 'Tenant not found for user' }, { status: 404 });
    }

    if (tenantUser.role !== UserRole.ADMIN && tenantUser.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
    }

    const body = await req.json();
    const { primaryColor, accentColor, logoUrl, themeMode } = body;

    // Upsert: INSERT with all cols, ON CONFLICT update only the provided ones
    const resConfig = await client.query(
      `INSERT INTO tenant_configs (tenant_id, primary_color, accent_color, logo_url, theme_mode)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         primary_color = COALESCE($2, excluded.primary_color),
         accent_color = COALESCE($3, excluded.accent_color),
         logo_url = COALESCE($4, excluded.logo_url),
         theme_mode = COALESCE($5, excluded.theme_mode)
       RETURNING primary_color, accent_color, logo_url, theme_mode`,
      [tenantUser.tenant_id, primaryColor, accentColor, logoUrl, themeMode]
    );

    const data = resConfig.rows[0];

    return NextResponse.json({
      branding: {
        primaryColor: data.primary_color,
        accentColor: data.accent_color,
        logoUrl: data.logo_url,
        themeMode: data.theme_mode
      }
    });
  } catch (err) {
    logger.error('api.tenant.config.patch.error', { error: String(err) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    client.release();
  }
}
