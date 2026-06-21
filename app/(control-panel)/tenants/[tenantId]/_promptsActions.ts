"use server";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type TenantAgent = {
  id: string;
  name: string;
  objective: string;
  model: string;
  systemPrompt: string;
  moduleAssigned: string;
  enabledTools: string[];
  createdAt: string;
};

export async function getTenantAgents(tenantId: string): Promise<TenantAgent[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, objective, model, system_prompt, module_assigned, enabled_tools, created_at 
       FROM tenant_agents 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      objective: r.objective || '',
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
      `INSERT INTO tenant_agents (tenant_id, name, objective, model, system_prompt, module_assigned, enabled_tools)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId, 
        data.name, 
        data.objective || '',
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

export async function updateTenantAgent(tenantId: string, agentId: string, data: Partial<TenantAgent>) {
  try {
    await pool.query(
      `UPDATE tenant_agents 
       SET name = $1, objective = $2, model = $3, system_prompt = $4, module_assigned = $5, enabled_tools = $6
       WHERE id = $7 AND tenant_id = $8`,
      [
        data.name, 
        data.objective || '',
        data.model || 'gpt-4o', 
        data.systemPrompt || '', 
        data.moduleAssigned || '',
        data.enabledTools || [],
        agentId,
        tenantId
      ]
    );
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating agent:", error);
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
