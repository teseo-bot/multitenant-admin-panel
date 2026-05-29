import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tenant Isolation (ADR-135)
    // Usualmente extraído del JWT o context, por ahora forzamos validación de identidad
    // para asegurar que las queries RPC se acotan al RLS del user/tenant.

    // 1. Orquestación concurrente de múltiples fuentes (Facade Pattern)
    const [conversionMetricsReq, finopsReq, handoffReq] = await Promise.all([
      // Llamada al RPC existente de analítica
      supabase.rpc("rpc_get_conversion_metrics"),
      
      // Sumatoria de costos FinOps del mes actual
      supabase
        .from('finops_token_ledger')
        .select('total_cost')
        .gte('created_at', new Date(new Date().setDate(1)).toISOString()), // Primer día del mes
        
      // Leads que requieren intervención humana
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('pipeline_status', ['pending_handoff', 'handoff'])
    ]);

    // 2. Procesamiento de Resultados
    const metrics = conversionMetricsReq.data?.[0] || { total_leads: 0, avg_conversion_rate: 0 };
    
    // Suma segura de FinOps (puede retornar array vacío)
    const totalCostUsd = finopsReq.data 
      ? finopsReq.data.reduce((acc, curr) => acc + Number(curr.total_cost || 0), 0)
      : 0;

    const pendingHandoffs = handoffReq.count || 0;

    // 3. Payload Unificado
    return NextResponse.json({
      leads: {
        total: metrics.total_leads,
        conversionRate: Number(metrics.avg_conversion_rate || 0).toFixed(1)
      },
      finops: {
        totalCostUsd: Number(totalCostUsd).toFixed(4),
        currency: "USD"
      },
      handoffs: {
        pending: pendingHandoffs
      }
    });

  } catch (error) {
    console.error("[Dashboard Facade] Error Crítico:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
