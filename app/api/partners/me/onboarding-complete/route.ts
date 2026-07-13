// app/api/partners/me/onboarding-complete/route.ts
// KL1-W2: marca el onboarding del miembro como completado.

import { NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const guard = await requirePartnerMember();

    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const partnerId = guard.partner.id;
    const uid = guard.uid;

    // Marca onboarded_at = now() para este (partner_id, user_id)
    const { rows } = await pool.query(
      `UPDATE partner_members
       SET onboarded_at = now()
       WHERE partner_id = $1 AND user_id = $2
       RETURNING partner_id, user_id, onboarded_at`,
      [partnerId, uid]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Membership no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, onboarded_at: rows[0].onboarded_at });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.onboarding-complete.error", {
      error: String(err),
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
