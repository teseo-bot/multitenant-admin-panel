// app/api/internal/tenant/aliados/route.ts
// PA4-W4b-1 (docs/aliados): endpoint interno M2M (S2S) que el tenant-admin-panel (otro
// repo, plano tenant) consumirá para mostrarle al tenant sus contratos de aliado.
// partner_contracts vive en el control-plane (este panel) — aislamiento de planos,
// decisión del CEO. Auth por api-key (sin sesión de usuario), mismo patrón EXACTO que
// app/api/internal/user-modules/route.ts.
//
// Proyección segura: SIEMPRE filtrada por tenant_id en el WHERE del servidor (jamás en
// el cliente) — el WHERE tenant_id es la frontera de aislamiento [RP-PA-11]. Se excluyen
// scope completo y campos de firma internos (signed_by_*, terms_sha256); ver
// lib/partners/tenant-aliados-projection.ts::shapeRow.
//
// [INV-7.4]: se devuelven TODOS los estados (draft…terminated/expired) para que el
// tenant-panel distinga vigentes de históricos. Orden: contratos 'vigente'
// (active|suspended|pending_signature|draft, ver categorizeContract) primero, luego
// 'historico' (terminated|expired); dentro de cada grupo, valid_until DESC.
//
// DESVIACIÓN de la spec: la WU describe `tenant_id=<uuid>` y "422 si ... está mal
// formado", pero el schema real (migrations-gcp/007_partner_contracts.sql) tipa
// tenant_id como TEXT (uid de Identity Platform, ADR-206 D-206.3), no UUID — y
// lib/partners/contracts.ts::CreateContractBodySchema ya valida tenant_id como
// `z.string().min(1)`, no `.uuid()`, en la ruta admin equivalente. Se valida aquí
// presencia + no-vacío (trim) como "mal formado"; NO se exige forma de UUID.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  shapeRow,
  type RawTenantAliadoJoinRow,
  type TenantAliadoContractRow,
} from "@/lib/partners/tenant-aliados-projection";

export type { TenantAliadoContractRow };

export const dynamic = "force-dynamic";

// Última versión publicada por paquete (ORDER BY version DESC LIMIT 1, vía LATERAL) —
// LEFT JOIN porque un paquete puede aún no tener versión publicada, en cuyo caso
// version/manifest_sha256/kms_key_version salen null.
const TENANT_ALIADOS_QUERY = `
  SELECT
    pc.id AS contract_id,
    p.legal_name AS partner_legal_name,
    p.slug AS partner_slug,
    pkg.title AS package_title,
    pkg.slug AS package_slug,
    pkg.id AS package_id,
    ppv.version AS version,
    ppv.manifest_sha256 AS manifest_sha256,
    ppv.kms_key_version AS kms_key_version,
    pc.kind AS kind,
    pc.status AS status,
    pc.valid_from AS valid_from,
    pc.valid_until AS valid_until,
    pc.derived_knowledge_clause AS derived_knowledge_clause
  FROM partner_contracts pc
  JOIN partners p ON p.id = pc.partner_id
  JOIN partner_packages pkg ON pkg.id = pc.package_id
  LEFT JOIN LATERAL (
    SELECT version, manifest_sha256, kms_key_version
    FROM partner_package_versions
    WHERE package_id = pkg.id
    ORDER BY version DESC
    LIMIT 1
  ) ppv ON true
  WHERE pc.tenant_id = $1
  ORDER BY
    CASE WHEN pc.status IN ('active','suspended','pending_signature','draft') THEN 0 ELSE 1 END,
    pc.valid_until DESC
`;

export async function GET(request: NextRequest) {
  // Guard S2S: header x-api-key === M2M_API_KEY (espejo exacto de user-modules).
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.M2M_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenant_id")?.trim();
  if (!tenantId) {
    return NextResponse.json(
      {
        error: "Validación fallida",
        details: [{ path: "tenant_id", message: "requerido" }],
      },
      { status: 422 }
    );
  }

  try {
    const res = await pool.query<RawTenantAliadoJoinRow>(TENANT_ALIADOS_QUERY, [tenantId]);
    const contracts: TenantAliadoContractRow[] = res.rows.map(shapeRow);
    return NextResponse.json({ contracts });
  } catch (err) {
    logger.error("api.internal.tenant_aliados.db_error", { error: String(err) });
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
