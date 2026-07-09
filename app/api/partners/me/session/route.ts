// app/api/partners/me/session/route.ts
// KL4-W3: obtiene la sesión actual del aliado (member_role, partner info).
// Usado por el cliente para determinar si el botón Publicar es visible/activo.

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();

    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    return NextResponse.json({
      member_role: guard.member_role,
      partner: guard.partner,
      uid: guard.uid,
    });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.session.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
