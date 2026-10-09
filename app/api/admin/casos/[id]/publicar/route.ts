// app/api/admin/casos/[id]/publicar/route.ts
// ADR-224 D-224.2: `en_revision → publicado`. El compiler calcula el embedding del dolor, inserta
// la versión inmutable y fija `revisado_por` con el Platform Admin de la sesión.

import { NextRequest, NextResponse } from "next/server";
import { publicarCaso } from "@/lib/partners/casos-curaduria";
import { curaduriaDeps } from "@/lib/partners/casos-curaduria-deps";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await publicarCaso(curaduriaDeps, params.id);
  return NextResponse.json(r.body, { status: r.status });
}
