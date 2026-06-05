"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantUser = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  reportsTo: string;
  phone: string;
  securityNotes: string;
  role: string;
  tokenUsage: number;
  lastActive: string | null;
  createdAt: string;
};

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, job_title, reports_to, phone, security_notes, role, token_usage, last_active, created_at 
       FROM tenant_users 
       WHERE tenant_id = $1 
       ORDER BY created_at ASC`,
      [tenantId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      email: r.email || '',
      fullName: r.full_name || '',
      jobTitle: r.job_title || '',
      reportsTo: r.reports_to || '',
      phone: r.phone || '',
      securityNotes: r.security_notes || '',
      role: r.role || 'MEMBER',
      tokenUsage: r.token_usage || 0,
      lastActive: r.last_active ? r.last_active.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching tenant users:", error);
    return [];
  }
}

export async function createTenantAdmin(tenantId: string, data: Partial<TenantUser>) {
  try {
    await pool.query(
      `INSERT INTO tenant_users (tenant_id, email, full_name, job_title, reports_to, phone, security_notes, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ADMIN')`,
      [tenantId, data.email, data.fullName, data.jobTitle, data.reportsTo, data.phone, data.securityNotes]
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
