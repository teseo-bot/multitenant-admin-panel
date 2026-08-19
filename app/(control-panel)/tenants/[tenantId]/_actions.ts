"use server";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { OperationFormValues, ClientFormValues, SuspensionFormValues } from "./schemas";

// Esta consulta pedía CINCO columnas que no existen en el plano de control:
// telegram_bot_token, telegram_whitelisted_group_ids, suspension_status,
// suspension_reason y suspension_message. Las añade `migrations/001` y `002` — el
// directorio que NO corre nadie (el runner sólo aplica `migrations-gcp/`, con lista
// explícita). Ver la nota de las dos carpetas de migraciones.
//
// El efecto era doble y silencioso: el SELECT fallaba con 42703, el `catch` lo
// convertía en `null`, y el formulario se pintaba VACÍO para un tenant que sí tenía
// nombre y estado. Parecía «faltan datos por capturar» cuando era «la consulta no
// corre». Séptima vez del patrón en este programa.
export async function getTenantOperationSettings(tenantId: string) {
  try {
    const { rows } = await pool.query(
      `SELECT name, domain, orchestrator_url, status FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (rows.length === 0) {
      return null;
    }
    const tenant = rows[0];
    return {
      name: tenant.name || "",
      domain: tenant.domain || "",
      orchestratorUrl: tenant.orchestrator_url || "",
      telegramWhitelistedGroupIds: "",
      status: tenant.status === 'active',
      suspensionStatus: "active" as const,
      suspensionReason: "",
      suspensionMessage: "",
    };
  } catch (error: any) {
    // `null` aquí significa «no se pudo leer», y arriba se dibuja como formulario
    // vacío. Que el error quede en el log es lo único que distingue un tenant sin
    // datos de una consulta rota: no borrar este console.error.
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
    
    // Vacío se guarda como NULL, no como ''. `tenants` tiene UNIQUE (domain): dos tenants
    // en aprovisionamiento con domain = '' chocarían entre sí y el segundo fallaría con un
    // 23505 que no dice nada del formulario. En Postgres los NULL no colisionan en un UNIQUE.
    // Además es lo que `invitations.ts` comprueba (`if (!domain)`) para caer al panel de control.
    const oNull = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

    await pool.query(
      `UPDATE tenants 
       SET name = $1, domain = $2, orchestrator_url = $3, status = $4
       WHERE id = $5`,
      [
        values.name,
        oNull(values.domain),
        oNull(values.orchestratorUrl),
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

export async function updateTenantSuspension(tenantId: string, values: SuspensionFormValues) {
  try {
    await pool.query(
      `UPDATE tenants 
       SET suspension_status = $1, suspension_reason = $2, suspension_message = $3
       WHERE id = $4`,
      [values.suspensionStatus, values.suspensionReason || null, values.suspensionMessage || null, tenantId]
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating tenant suspension:", error);
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
    console.error("Error fetching tenant client settings:", error);
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
