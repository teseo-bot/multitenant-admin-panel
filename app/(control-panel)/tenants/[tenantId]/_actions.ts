"use server";

import { Pool } from "pg";
import { revalidatePath } from "next/cache";
import { OperationFormValues, ClientFormValues } from "./schemas";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getTenantOperationSettings(tenantId: string) {
  try {
    const { rows } = await pool.query(`SELECT name, domain, orchestrator_url, telegram_bot_token, telegram_whitelisted_group_ids, status FROM tenants WHERE id = $1`, [tenantId]);
    if (rows.length === 0) {
      return null;
    }
    const tenant = rows[0];
    return {
      name: tenant.name || "",
      domain: tenant.domain || "",
      orchestratorUrl: tenant.orchestrator_url || "",
      telegramBotToken: tenant.telegram_bot_token || "",
      telegramWhitelistedGroupIds: Array.isArray(tenant.telegram_whitelisted_group_ids) ? tenant.telegram_whitelisted_group_ids : [],
      status: tenant.status === 'active',
    };
  } catch (error: any) {
    if (error?.code === '42P01' || error?.code === '42703') {
      console.warn("Table does not exist yet, returning fallback.");
      return null;
    }
    console.error("Error fetching tenant operation settings:", error);
    return null;
  }
}

export async function updateTenantOperationSettings(
  tenantId: string,
  values: OperationFormValues
) {
  try {
    const statusStr = values.status ? 'active' : 'suspended';
    await pool.query(
      `UPDATE tenants 
       SET name = $1, domain = $2, orchestrator_url = $3, telegram_bot_token = $4, telegram_whitelisted_group_ids = $5, status = $6
       WHERE id = $7`,
      [
        values.name,
        values.domain,
        values.orchestratorUrl,
        values.telegramBotToken,
        JSON.stringify(values.telegramWhitelistedGroupIds),
        statusStr,
        tenantId
      ]
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating tenant operation settings:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getTenantClientSettings(tenantId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT company_name, contact_name, email, phone, finops_token_ledger 
       FROM tenants 
       WHERE id = $1`, 
      [tenantId]
    );
    if (rows.length === 0) {
      return null;
    }
    const tenant = rows[0];
    return {
      companyName: tenant.company_name || "",
      contactName: tenant.contact_name || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      monthlyTokenLimit: tenant.finops_token_ledger || 0,
    };
  } catch (error: any) {
    if (error?.code === '42P01' || error?.code === '42703') {
      console.warn("Table does not exist yet for client settings, returning fallback.");
    } else {
      console.error("Error fetching tenant client settings:", error);
    }
    return {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      monthlyTokenLimit: 0,
    };
  }
}

export async function updateTenantClientSettings(
  tenantId: string,
  values: ClientFormValues
) {
  try {
    await pool.query(
      `UPDATE tenants 
       SET company_name = $1, contact_name = $2, email = $3, phone = $4, finops_token_ledger = $5
       WHERE id = $6`,
      [
        values.companyName,
        values.contactName,
        values.email,
        values.phone,
        values.monthlyTokenLimit,
        tenantId
      ]
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating tenant client settings:", error);
    return { success: false, error: (error as Error).message };
  }
}
