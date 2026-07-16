// app/api/internal/user-modules/route.ts
// G2-W2 (Backend §C3 · TRD §6): endpoint M2M (S2S) para el guard de ingesta del
// tenant panel. Devuelve los módulos ACTIVOS que un usuario tiene asignados en un
// tenant. Auth por api-key (sin sesión de usuario).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Guard S2S: header x-api-key === M2M_API_KEY.
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.M2M_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const tenantId = searchParams.get("tenant_id");
  if (!userId || !tenantId) {
    return NextResponse.json(
      { error: "user_id and tenant_id required" },
      { status: 400 }
    );
  }

  try {
    // DESVIACIÓN de §C3 por el schema real (migrations-gcp/002): tenant_user_modules
    // se llavea por tenant_user_id (FK a tenant_users.id), no por user_id/tenant_id.
    // Join corregido a través de tenant_users. Sólo módulos activos a nivel tenant
    // (tenant_modules.is_active) → [INV-G4.3]: 2 activos + 1 inactivo ⇒ 2.
    const res = await pool.query<{ module_id: string }>(
      `SELECT tm.module_id
         FROM tenant_user_modules tum
         JOIN tenant_users   tu ON tu.id = tum.tenant_user_id
         JOIN tenant_modules tm ON tm.tenant_id = tu.tenant_id
                               AND tm.module_id = tum.module_id
                               AND tm.is_active
        WHERE tu.user_id = $1 AND tu.tenant_id = $2`,
      [userId, tenantId]
    );
    return NextResponse.json({ modules: res.rows.map((r) => r.module_id) });
  } catch (err) {
    logger.error("api.internal.user_modules.db_error", { error: String(err) });
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
