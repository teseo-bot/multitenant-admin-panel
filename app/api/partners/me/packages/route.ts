// app/api/partners/me/packages/route.ts
// KL1-W2: API de paquetes del aliado.
//
// GET: lista paquetes del partner (id, slug, title, description, systems, altitude_max, status, created_at)
// POST: crear nuevo paquete con validación — requiere partner.status === 'verified'

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CreatePackageBodySchema } from "@/lib/partners/packages";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guard = await requirePartnerMember();

    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const partnerId = guard.partner.id;

    const { rows } = await pool.query(
      `SELECT id, slug, title, description, systems, altitude_max, status, created_at
         FROM partner_packages
        WHERE partner_id = $1
        ORDER BY created_at DESC`,
      [partnerId]
    );

    return NextResponse.json({ packages: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.packages.get.error", { error: String(err) });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();

    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    // [INV-1.1] Si partner no está verificado, rechazar
    if (guard.partner.status !== "verified") {
      return NextResponse.json(
        { error: "El aliado debe estar verificado para crear paquetes" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreatePackageBodySchema.safeParse(body);

    if (!parsed.success) {
      // Formato de error: array de issues con path y message
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    const partnerId = guard.partner.id;
    const { slug, title, description, systems, altitude_max } = parsed.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO partner_packages (partner_id, slug, title, description, systems, altitude_max, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft')
         RETURNING id, slug, title, description, systems, altitude_max, status, created_at`,
        [partnerId, slug, title, description, systems, altitude_max]
      );

      const pkg = rows[0];
      return NextResponse.json(pkg, { status: 201 });
    } catch (err: any) {
      // UNIQUE violation: (partner_id, slug)
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un paquete con ese slug en tu aliado" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.packages.post.error", { error: String(err) });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
