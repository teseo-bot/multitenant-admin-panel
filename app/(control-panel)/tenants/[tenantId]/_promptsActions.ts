"use server";

import { pool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type TenantAgent = {
  id: string;
  name: string;
  objective: string;
  /** Slug del módulo al que pertenece el agente (`crm`, `compliance`, ...). */
  moduleId: string;
  /** Nombre legible del módulo, resuelto por JOIN. */
  moduleName: string;
  /** `null` ⇒ el orquestador usa su modelo por defecto. */
  model: string | null;
  systemPrompt: string;
  enabledTools: string[];
  isActive: boolean;
  createdAt: string;
};

export type TenantModule = { id: string; name: string };

/**
 * Resultado explícito en vez de `[]` a secas.
 *
 * POR QUÉ: la versión anterior hacía `catch { return [] }`, así que un `42P01` —la tabla no
 * existía en este plano— llegaba a la UI como «no hay agentes configurados». El formulario
 * estuvo meses sin guardar nada y la pantalla decía que todo estaba bien. Una lista vacía y un
 * fallo tienen que ser estados DISTINTOS o el error se vuelve invisible.
 */
export type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getTenantAgents(tenantId: string): Promise<Resultado<TenantAgent[]>> {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.objective, a.module_id, a.model, a.system_prompt,
              a.enabled_tools, a.is_active, a.created_at,
              COALESCE(m.name, a.module_id) AS module_name
         FROM tenant_agents a
         LEFT JOIN modules m ON m.id = a.module_id
        WHERE a.tenant_id = $1
        ORDER BY a.is_active DESC, m.sort_order NULLS LAST, a.created_at DESC`,
      [tenantId]
    );
    return {
      ok: true,
      data: rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        objective: r.objective || "",
        moduleId: r.module_id,
        moduleName: r.module_name,
        model: r.model,
        systemPrompt: r.system_prompt || "",
        enabledTools: r.enabled_tools || [],
        isActive: r.is_active,
        createdAt: r.created_at.toISOString(),
      })),
    };
  } catch (error: any) {
    console.error("[agentes] fallo leyendo tenant_agents:", error);
    return { ok: false, error: mensajeDeError(error) };
  }
}

/** Módulos disponibles para asignar. Sale de `modules`, no de una lista en el cliente. */
export async function getModules(): Promise<Resultado<TenantModule[]>> {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM modules WHERE is_active ORDER BY sort_order, name`
    );
    return { ok: true, data: rows.map((r: any) => ({ id: r.id, name: r.name })) };
  } catch (error: any) {
    console.error("[agentes] fallo leyendo modules:", error);
    return { ok: false, error: mensajeDeError(error) };
  }
}

export async function createTenantAgent(tenantId: string, data: Partial<TenantAgent>) {
  try {
    await pool.query(
      `INSERT INTO tenant_agents
         (tenant_id, module_id, name, objective, model, system_prompt, enabled_tools, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        data.moduleId || "crm",
        data.name,
        data.objective || "",
        // Cadena vacía ⇒ NULL: «sin elegir» y «elegido vacío» no pueden ser el mismo estado.
        data.model || null,
        data.systemPrompt || "",
        data.enabledTools || [],
        data.isActive ?? true,
      ]
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[agentes] fallo creando agente:", error);
    return { success: false, error: mensajeDeError(error) };
  }
}

export async function updateTenantAgent(tenantId: string, agentId: string, data: Partial<TenantAgent>) {
  try {
    await pool.query(
      `UPDATE tenant_agents
          SET module_id = $1, name = $2, objective = $3, model = $4,
              system_prompt = $5, enabled_tools = $6, is_active = $7,
              updated_at = timezone('utc', now())
        WHERE id = $8 AND tenant_id = $9`,
      [
        data.moduleId || "crm",
        data.name,
        data.objective || "",
        data.model || null,
        data.systemPrompt || "",
        data.enabledTools || [],
        data.isActive ?? true,
        agentId,
        tenantId,
      ]
    );
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[agentes] fallo actualizando agente:", error);
    return { success: false, error: mensajeDeError(error) };
  }
}

export async function deleteTenantAgent(tenantId: string, agentId: string) {
  try {
    await pool.query(`DELETE FROM tenant_agents WHERE id = $1 AND tenant_id = $2`, [agentId, tenantId]);
    revalidatePath(`/tenants/${tenantId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[agentes] fallo borrando agente:", error);
    return { success: false, error: mensajeDeError(error) };
  }
}

/**
 * Traduce los fallos de Postgres que este formulario puede provocar de verdad.
 *
 * `error.message` crudo no se devuelve nunca al cliente: ADR-208 dejó escrito que una tool que
 * expone el mensaje de la base filtra nombres de tablas y columnas a quien no debe verlos.
 */
function mensajeDeError(error: any): string {
  switch (error?.code) {
    case "23505":
      return "Ese módulo ya tiene un agente activo en este tenant. Desactiva el actual antes de crear otro, o edita el que ya existe.";
    case "23503":
      return "El módulo seleccionado no existe.";
    case "42P01":
      return "La tabla de agentes no existe en esta base. Falta aplicar la migración 015_tenant_agents.sql en el plano de control.";
    case "42703":
      return "El esquema de la tabla de agentes no coincide con el que espera el panel. Revisa que la migración 015 se haya aplicado completa.";
    default:
      return "No se pudo completar la operación. Revisa los logs del panel para el detalle.";
  }
}
