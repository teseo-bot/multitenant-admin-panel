"use server";

import { BrandingConfig } from "./_brandingTypes";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getTenantBranding(tenantId: string): Promise<BrandingConfig | null> {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT primary_color, secondary_color, accent_color, background_color, card_background_color, 
              logo_light_url, logo_dark_url, favicon_url, app_icon_url, theme_mode 
       FROM tenant_configs WHERE tenant_id = $1`,
      [tenantId]
    );
    client.release();

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        primaryColor: row.primary_color || '#007bff',
        secondaryColor: row.secondary_color || '#6c757d',
        accentColor: row.accent_color || '#6c757d',
        backgroundColor: row.background_color || '#ffffff',
        cardBackgroundColor: row.card_background_color || '#ffffff',
        logoLightUrl: row.logo_light_url || '',
        logoDarkUrl: row.logo_dark_url || '',
        faviconUrl: row.favicon_url || '',
        appIconUrl: row.app_icon_url || '',
        themeMode: row.theme_mode || 'system',
      };
    } else {
      return {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        accentColor: '#6c757d',
        backgroundColor: '#ffffff',
        cardBackgroundColor: '#ffffff',
        logoLightUrl: '',
        logoDarkUrl: '',
        faviconUrl: '',
        appIconUrl: '',
        themeMode: 'system',
      };
    }
  } catch (error: any) {
    console.error(`Failed to fetch branding for tenant ${tenantId}:`, error);
    throw new Error('Failed to fetch tenant branding configuration.');
  }
}

export async function updateTenantBranding(tenantId: string, data: BrandingConfig) {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO tenant_configs (
         tenant_id, primary_color, secondary_color, accent_color, background_color, card_background_color,
         logo_light_url, logo_dark_url, favicon_url, app_icon_url, theme_mode
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id) DO UPDATE SET
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         accent_color = EXCLUDED.accent_color,
         background_color = EXCLUDED.background_color,
         card_background_color = EXCLUDED.card_background_color,
         logo_light_url = EXCLUDED.logo_light_url,
         logo_dark_url = EXCLUDED.logo_dark_url,
         favicon_url = EXCLUDED.favicon_url,
         app_icon_url = EXCLUDED.app_icon_url,
         theme_mode = EXCLUDED.theme_mode
       RETURNING *`,
      [
        tenantId, data.primaryColor, data.secondaryColor, data.accentColor, data.backgroundColor, 
        data.cardBackgroundColor, data.logoLightUrl, data.logoDarkUrl, data.faviconUrl, 
        data.appIconUrl, data.themeMode
      ]
    );
    client.release();
    return result.rows[0];
  } catch (error) {
    console.error(`Failed to update branding for tenant ${tenantId}:`, error);
    throw new Error('Failed to update tenant branding configuration.');
  }
}
