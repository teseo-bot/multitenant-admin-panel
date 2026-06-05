"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantAgent = {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  moduleAssigned: string;
  enabledTools: string[];
  createdAt: string;
};

export async function getTenantAgents(tenantId: string): Promise<TenantAgent[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, model, system_prompt, module_assigned, enabled_tools, created_at 
       FROM tenant_agents 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      model: r.model,
      systemPrompt: r.system_prompt,
      moduleAssigned: r.module_assigned,
      enabledTools: r.enabled_tools || [],
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching tenant agents:", error);
    return [];
  }
}

export async function createTenantAgent(tenantId: string, data: Partial<TenantAgent>) {
  try {
    await pool.query(
      `INSERT INTO tenant_agents (tenant_id, name, model, system_prompt, module_assigned, enabled_tools)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId, 
        data.name, 
        data.model || 'gpt-4o', 
        data.systemPrompt || '', 
        data.moduleAssigned || '',
        data.enabledTools || []
      ]
    );
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error creating agent:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTenantAgent(tenantId: string, agentId: string) {
  try {
    await pool.query(`DELETE FROM tenant_agents WHERE id = $1 AND tenant_id = $2`, [agentId, tenantId]);
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting agent:", error);
    return { success: false, error: error.message };
  }
}
