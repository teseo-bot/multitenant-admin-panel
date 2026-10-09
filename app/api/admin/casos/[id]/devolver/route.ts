// app/api/admin/casos/[id]/devolver/route.ts
// ADR-224 D-224.2: `en_revision → borrador` con el motivo que leerá el aliado. El curador
// (`revisado_por`) es el Platform Admin de la sesión.

import { NextRequest, NextResponse } from "next/server";
import { devolverCaso } from "@/lib/partners/casos-curaduria";
import { curaduriaDeps } from "@/lib/partners/casos-curaduria-deps";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await devolverCaso(curaduriaDeps, params.id, await req.json().catch(() => null));
  return NextResponse.json(r.body, { status: r.status });
}
