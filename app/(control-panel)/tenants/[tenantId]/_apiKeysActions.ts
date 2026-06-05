"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantLLMKey = {
  id: string;
  provider: string;
  apiKeyPrefix: string; // we only send prefix to UI for security
  createdAt: string;
};

export async function getLLMKeys(tenantId: string): Promise<TenantLLMKey[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, provider, api_key, created_at 
       FROM tenant_llm_keys 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      provider: r.provider,
      // Mask key for UI
      apiKeyPrefix: r.api_key ? r.api_key.substring(0, 8) + '...' : '',
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching LLM keys:", error);
    return [];
  }
}

export async function upsertLLMKey(tenantId: string, provider: string, apiKey: string) {
  try {
    await pool.query(
      `INSERT INTO tenant_llm_keys (tenant_id, provider, api_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, provider) 
       DO UPDATE SET api_key = EXCLUDED.api_key, created_at = NOW()`,
      [tenantId, provider, apiKey]
    );
    
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error upserting LLM key:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteLLMKey(tenantId: string, id: string) {
  try {
    await pool.query(`DELETE FROM tenant_llm_keys WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting LLM key:", error);
    return { success: false, error: error.message };
  }
}
