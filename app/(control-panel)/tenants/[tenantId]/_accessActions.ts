"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantUser = {
  id: string;
  email: string;
  role: string;
  tokenUsage: number;
  lastActive: string | null;
  createdAt: string;
};

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, token_usage, last_active, created_at 
       FROM tenant_users 
       WHERE tenant_id = $1 
       ORDER BY created_at ASC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      tokenUsage: r.token_usage || 0,
      lastActive: r.last_active ? r.last_active.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    return [];
  }
}

export async function createTenantAdmin(tenantId: string, email: string) {
  try {
    await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, role)
       VALUES ($1, $2, 'admin')`,
      [tenantId, email]
    );
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error creating tenant admin:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTenantUser(tenantId: string, userId: string) {
  try {
    await pool.query(`DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);
    revalidatePath(`/control-panel/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return { success: false, error: error.message };
  }
}
