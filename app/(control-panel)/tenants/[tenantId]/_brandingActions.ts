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
      'SELECT primary_color, accent_color, logo_url, theme_mode FROM tenant_configs WHERE tenant_id = $1',
      [tenantId]
    );
    client.release();

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        primaryColor: row.primary_color,
        accentColor: row.accent_color,
        logoUrl: row.logo_url,
        themeMode: row.theme_mode,
      };
    } else {
      // Return default values if no config found
      return {
        primaryColor: '#007bff',
        accentColor: '#6c757d',
        logoUrl: 'https://example.com/default-logo.png',
        themeMode: 'system',
      };
    }
  } catch (error: any) {
    if (error?.code === '42P01' || error?.code === '42703') {
      console.warn('Table tenant_configs does not exist yet. Returning fallback.');
      return {
        primaryColor: '#007bff',
        accentColor: '#6c757d',
        logoUrl: 'https://example.com/default-logo.png',
        themeMode: 'system',
      };
    }
    console.error(`Failed to fetch branding for tenant ${tenantId}:`, error);
    throw new Error('Failed to fetch tenant branding configuration.');
  }
}

export async function updateTenantBranding(tenantId: string, data: BrandingConfig) {
  try {
    
    const client = await pool.connect();
    const result = await client.query(
      `INSERT INTO tenant_configs (tenant_id, primary_color, accent_color, logo_url, theme_mode)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
       primary_color = EXCLUDED.primary_color,
       accent_color = EXCLUDED.accent_color,
       logo_url = EXCLUDED.logo_url,
       theme_mode = EXCLUDED.theme_mode
       RETURNING *`,
      [data.primaryColor, data.accentColor, data.logoUrl, data.themeMode, tenantId]
    );
    client.release();
    return result.rows[0];
  } catch (error) {
    console.error(`Failed to update branding for tenant ${tenantId}:`, error);
    throw new Error('Failed to update tenant branding configuration.');
  }
}
