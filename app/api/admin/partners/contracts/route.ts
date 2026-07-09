// app/api/admin/partners/contracts/route.ts
// PA4-W1 — Knowledge Ops: CRUD de contratos de aliado (TRD §7.2).
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).
//
// GET: lista contratos, filtros opcionales ?partner_id=&tenant_id=&status=.
// POST: crea contrato. Valida kind (zod) y [INV-4.1] scope ⊆ package (systems/altitude_max —
// ver nota en lib/partners/contract-state-machine.ts sobre `modules` de package, que no
// existe en el schema/DDL real). El contrato nace en `status='draft'` (default de la DDL,
// migrations-gcp/007_partner_contracts.sql); esta WU no expone una acción para avanzarlo a
// `pending_signature` (el set de acciones de transición admin es exactamente
// activate|suspend|terminate, ver lib/partners/contracts.ts::ContractTransitionActionSchema).

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CreateContractBodySchema } from "@/lib/partners/contracts";
import { scopeSubsetOfPackage } from "@/lib/partners/contract-state-machine";

export const dynamic = "force-dynamic";

const CONTRACT_COLUMNS =
  "id, partner_id, tenant_id, package_id, kind, scope, fee_model, derived_knowledge_clause, " +
  "valid_from, valid_until, status, terms_sha256, signed_by_partner, signed_by_teseo, created_at";

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const url = new URL(req.url);
    const partnerId = url.searchParams.get("partner_id") || undefined;
    const tenantId = url.searchParams.get("tenant_id") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (partnerId) {
      conditions.push(`partner_id = $${i++}`);
      values.push(partnerId);
    }
    if (tenantId) {
      conditions.push(`tenant_id = $${i++}`);
      values.push(tenantId);
    }
    if (status) {
      conditions.push(`status = $${i++}`);
      values.push(status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ${CONTRACT_COLUMNS} FROM partner_contracts ${where} ORDER BY created_at DESC`,
      values
    );
    return NextResponse.json({ contracts: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.contracts.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const parsed = CreateContractBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const data = parsed.data;

    if (new Date(data.valid_until) <= new Date(data.valid_from)) {
      return NextResponse.json(
        { error: "Validación fallida", details: [{ path: "valid_until", message: "debe ser posterior a valid_from" }] },
        { status: 422 }
      );
    }

    const { rows: pkgRows } = await pool.query(
      `SELECT partner_id, systems, altitude_max FROM partner_packages WHERE id = $1`,
      [data.package_id]
    );
    if (pkgRows.length === 0) {
      return NextResponse.json(
        { error: "Validación fallida", details: [{ path: "package_id", message: "paquete no encontrado" }] },
        { status: 422 }
      );
    }
    const pkg = pkgRows[0];
    if (pkg.partner_id !== data.partner_id) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: [{ path: "package_id", message: "el paquete no pertenece al partner_id indicado" }],
        },
        { status: 422 }
      );
    }

    // [INV-4.1]. `pkg` real no tiene `modules` (ver nota en contract-state-machine.ts) —
    // se omite ese check aquí, coherente con el INV-4.1 canónico (WORKFLOWS-Aliados.md:60).
    const subset = scopeSubsetOfPackage(data.scope, {
      systems: pkg.systems,
      altitude_max: pkg.altitude_max,
    });
    if (!subset.ok) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: subset.violations.map((v) => ({ path: "scope", message: v })),
        },
        { status: 422 }
      );
    }

    const { rows } = await pool.query(
      `INSERT INTO partner_contracts
         (partner_id, tenant_id, package_id, kind, scope, fee_model, derived_knowledge_clause, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${CONTRACT_COLUMNS}`,
      [
        data.partner_id,
        data.tenant_id,
        data.package_id,
        data.kind,
        JSON.stringify(data.scope),
        JSON.stringify(data.fee_model),
        data.derived_knowledge_clause,
        data.valid_from,
        data.valid_until,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.contracts.post.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
