// lib/services/audit.ts
// WU-15 (E8): Lectura de la bitácora de gestión de usuarios (user_management_audit).

import { pool } from "@/lib/db";

export interface AuditEvent {
  id: string;
  actorId: string | null;
  tenantId: string | null;
  targetUser: string | null;
  action: string;
  detail: unknown;
  createdAt: string;
}

export interface AuditFilter {
  tenantId?: string;
  action?: string;
  limit?: number;
}

export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEvent[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`tenant_id = $${params.length}`); }
  if (filter.action) { params.push(filter.action); where.push(`action = $${params.length}`); }

  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT id, actor_id, tenant_id, target_user, action, detail, created_at
     FROM public.user_management_audit
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map((r: any) => ({
    id: String(r.id),
    actorId: r.actor_id,
    tenantId: r.tenant_id,
    targetUser: r.target_user,
    action: r.action,
    detail: r.detail,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
