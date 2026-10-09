// app/api/admin/casos/[id]/route.ts
// ADR-224 D-224.2: un caso para curar — contenido, hallazgos, versiones, el aliado y sus fuentes
// de evidencia resueltas. Sólo Platform Admin.

import { NextRequest, NextResponse } from "next/server";
import { casoDeCuraduria } from "@/lib/partners/casos-curaduria";
import { curaduriaDeps } from "@/lib/partners/casos-curaduria-deps";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await casoDeCuraduria(curaduriaDeps, params.id);
  return NextResponse.json(r.body, { status: r.status });
}
