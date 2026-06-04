"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type TenantUserRole = "Owner" | "Admin" | "Viewer";

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  role: TenantUserRole;
  created_at: string;
}

export async function getTenantUsers(tenantId: string) {
  try {
    const query = `
      SELECT id, tenant_id, email, role, created_at
      FROM tenant_users
      WHERE tenant_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [tenantId]);
    return { success: true, users: result.rows as TenantUser[] };
  } catch (error: any) {
    console.error("Error fetching tenant users:", error);
    // If the table doesn't exist yet, we can return an empty array to avoid breaking the UI during dev
    if (error?.code === '42P01') { 
        return { success: true, users: [] };
    }
    return { success: false, error: "Failed to fetch tenant users." };
  }
}

export async function inviteTenantUser(tenantId: string, email: string, role: TenantUserRole) {
  try {
    const query = `
      INSERT INTO tenant_users (tenant_id, email, role)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    await pool.query(query, [tenantId, email, role]);
    
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error inviting user:", error);
    return { success: false, error: "Failed to invite user. " + error?.message };
  }
}

export async function updateTenantUserRole(userId: string, newRole: TenantUserRole) {
  try {
    const query = `
      UPDATE tenant_users
      SET role = $1
      WHERE id = $2
      RETURNING tenant_id;
    `;
    const res = await pool.query(query, [newRole, userId]);
    
    if (res.rows.length > 0) {
        revalidatePath(`/tenants/${res.rows[0].tenant_id}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error updating user role:", error);
    return { success: false, error: "Failed to update user role." };
  }
}

export async function removeTenantUser(userId: string) {
  try {
    const query = `
      DELETE FROM tenant_users
      WHERE id = $1
      RETURNING tenant_id;
    `;
    const res = await pool.query(query, [userId]);
    
    if (res.rows.length > 0) {
        revalidatePath(`/tenants/${res.rows[0].tenant_id}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error removing user:", error);
    return { success: false, error: "Failed to remove user." };
  }
}

export async function getFleetcoPlusStatus(tenantId: string) {
  try {
    const query = `
      SELECT fleetco_plus_enabled
      FROM tenants
      WHERE id = $1;
    `;
    const result = await pool.query(query, [tenantId]);
    if (result.rows.length > 0) {
        return { success: true, enabled: result.rows[0].fleetco_plus_enabled };
    }
    return { success: true, enabled: false };
  } catch (error: any) {
    console.error("Error fetching Fleetco+ status:", error);
    if (error?.code === '42703') { // column does not exist
        return { success: true, enabled: false };
    }
    return { success: false, error: "Failed to fetch status." };
  }
}

export async function toggleFleetcoPlusStatus(tenantId: string, enabled: boolean) {
  try {
    // Note: Assuming 'fleetco_plus_enabled' column exists. If not, this might throw, which is handled.
    const query = `
      UPDATE tenants
      SET fleetco_plus_enabled = $1
      WHERE id = $2;
    `;
    await pool.query(query, [enabled, tenantId]);
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error toggling Fleetco+ status:", error);
    return { success: false, error: "Failed to update Fleetco+ status." };
  }
}
