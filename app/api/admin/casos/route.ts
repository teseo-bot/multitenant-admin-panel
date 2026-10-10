// app/api/admin/casos/route.ts
// ADR-224 D-224.2: la cola de curaduría — los casos de éxito que los aliados mandaron a revisión,
// el más antiguo primero, con el nombre del aliado. Sólo Platform Admin.

import { NextResponse } from "next/server";
import { colaDeCuraduria } from "@/lib/partners/casos-curaduria";
import { curaduriaDeps } from "@/lib/partners/casos-curaduria-deps";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await colaDeCuraduria(curaduriaDeps);
  return NextResponse.json(r.body, { status: r.status });
}
