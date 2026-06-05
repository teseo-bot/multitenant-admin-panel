"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantIntegration = {
  id: string;
  toolId: string;
  config: string; // JSON string format for the UI
  createdAt: string;
};

export async function getTenantIntegrations(tenantId: string): Promise<TenantIntegration[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, tool_id, config, created_at 
       FROM tenant_integrations 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      toolId: r.tool_id,
      config: JSON.stringify(r.config, null, 2),
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching tenant integrations:", error);
    return [];
  }
}

export async function upsertTenantIntegration(tenantId: string, toolId: string, configJson: string) {
  try {
    // Validate JSON
    const parsedConfig = JSON.parse(configJson);

    await pool.query(
      `INSERT INTO tenant_integrations (tenant_id, tool_id, config)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, tool_id) 
       DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()`,
      [tenantId, toolId, parsedConfig]
    );
    
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error upserting integration:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTenantIntegration(tenantId: string, id: string) {
  try {
    await pool.query(`DELETE FROM tenant_integrations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting integration:", error);
    return { success: false, error: error.message };
  }
}
