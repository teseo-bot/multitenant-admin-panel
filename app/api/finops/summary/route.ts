// app/api/finops/summary/route.ts
// Frontera server/client: el hook `use-finops-summary` (componente cliente
// `finops-dashboard.tsx`) consumía `fetchFinancialSummary` directamente, lo que
// arrastraba `pg` (lib/db) al bundle del navegador y rompía el build
// (Module not found: dns/net/tls). El fetch de datos vive ahora aquí, en el servidor.

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { fetchFinancialSummary } from "@/lib/finops-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await fetchFinancialSummary();
    return NextResponse.json(data);
  } catch (error) {
    logger.error("[finops/summary] error:", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Error al obtener el resumen FinOps" }, { status: 500 });
  }
}
