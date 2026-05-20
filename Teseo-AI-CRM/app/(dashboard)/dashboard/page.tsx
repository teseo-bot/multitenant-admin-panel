"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BrainCircuit, MessageSquare, Briefcase, DollarSign, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function TenantDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    conversionRate: 0,
    interactions: 0,
    activePipeline: "$0",
    funnel: [
      { stage: "Leads Entrantes", count: 0, pct: "0%", color: "bg-blue-500" },
      { stage: "Contactados por SDR", count: 0, pct: "0%", color: "bg-indigo-500" },
      { stage: "Perfilados (MQL)", count: 0, pct: "0%", color: "bg-purple-500" },
      { stage: "Venta Cerrada (Won)", count: 0, pct: "0%", color: "bg-emerald-500" },
      { stage: "Perdidos (Lost)", count: 0, pct: "0%", color: "bg-red-500" }
    ],
    recentDeals: [] as any[]
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      const supabase = createClient();

      // Get basic conversion metrics from RPC
      const { data: convMetrics } = await supabase.rpc("rpc_get_conversion_metrics");
      
      // Get interactions count
      const { count: msgsCount } = await supabase
        .from("inbox_messages")
        .select("*", { count: "exact", head: true });

      // Get funnel breakdown
      const { data: statusBreakdown } = await supabase.rpc("rpc_get_leads_by_status");

      // Get recent won/pipeline leads
      const { data: deals } = await supabase
        .from("leads")
        .select("id, name, status, icp_score")
        .in("status", ["Won", "Qualified", "Contacted", "Lost"])
        .order("updated_at", { ascending: false })
        .limit(4);

      if (convMetrics || statusBreakdown || deals) {
        const tLeads = convMetrics?.[0]?.total_leads || 0;
        const wonL = convMetrics?.[0]?.won_leads || 0;
        const lostL = convMetrics?.[0]?.lost_leads || 0;
        const convR = convMetrics?.[0]?.avg_conversion_rate || 0;
        
        let contactedCount = 0;
        let qualifiedCount = 0;
        
        if (statusBreakdown) {
          contactedCount = statusBreakdown.find((s: any) => s.status === 'Contacted')?.total || 0;
          qualifiedCount = statusBreakdown.find((s: any) => s.status === 'Qualified')?.total || 0;
        }

        // Calculate funnel pcts
        const getPct = (val: number) => tLeads > 0 ? `${Math.round((val / tLeads) * 100)}%` : "0%";

        const recentFormatted = (deals || []).map((d: any) => ({
          name: d.name,
          value: d.icp_score ? `Score: ${d.icp_score}` : "-",
          stage: d.status,
          prob: d.status === "Won" ? "100%" : d.status === "Qualified" ? "70%" : "30%",
          lost: d.status === "Lost"
        }));

        setMetrics({
          totalLeads: tLeads,
          conversionRate: convR,
          interactions: msgsCount || 0,
          activePipeline: "Calculando...", // Needs value in metadata
          funnel: [
            { stage: "Leads Entrantes", count: tLeads, pct: "100%", color: "bg-blue-500" },
            { stage: "Contactados por SDR", count: contactedCount + qualifiedCount + wonL + lostL, pct: getPct(contactedCount + qualifiedCount + wonL + lostL), color: "bg-indigo-500" },
            { stage: "Perfilados (MQL)", count: qualifiedCount + wonL, pct: getPct(qualifiedCount + wonL), color: "bg-purple-500" },
            { stage: "Venta Cerrada (Won)", count: wonL, pct: getPct(wonL), color: "bg-emerald-500" },
            { stage: "Perdidos (Lost)", count: lostL, pct: getPct(lostL), color: "bg-red-500" }
          ],
          recentDeals: recentFormatted
        });
      }
      setLoading(false);
    }

    fetchDashboard();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto py-6 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard CRM</h1>
        <p className="text-muted-foreground">Métricas de conversión, pipeline y rendimiento de tus agentes IA.</p>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nuevos Leads (Totales)</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "-" : metrics.totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Acumulados
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasa Conversión (Won)</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <BrainCircuit className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "-" : `${metrics.conversionRate}%`}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Perfilados por Gatekeeper
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interacciones IA</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "-" : metrics.interactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Mensajes procesados</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Activo (Est.)</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? "-" : metrics.activePipeline}</div>
            <p className="text-xs text-muted-foreground mt-1">Basado en score</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticas */}
      <Card className="border-amber-500/50 bg-amber-500/5 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-500">Buzón Abierto</h3>
              <p className="text-sm text-amber-700/80 dark:text-amber-500/80">
                Revisa los mensajes entrantes en el Inbox.
              </p>
            </div>
          </div>
          <Link href="/inbox" passHref>
            <Button variant="outline" className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10">
              Ir al Inbox <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Gráfica Funnel de Ventas */}
        <Card className="col-span-2 shadow-sm border-t-0">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Embudo Comercial</CardTitle>
            <CardDescription>Flujo de los prospectos.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Cargando embudo...</div>
              ) : (
                metrics.funnel.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.stage}</span>
                      <span className="text-muted-foreground font-mono">{item.count} ({item.pct})</span>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: item.pct }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cierres Recientes / Rendimiento de Ventas */}
        <Card className="col-span-1 shadow-sm border-t-0 flex flex-col">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" /> Oportunidades Clave</CardTitle>
            <CardDescription>Leads activos.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex-1">
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-sm py-4">Cargando...</div>
              ) : metrics.recentDeals.length === 0 ? (
                <div className="text-center text-sm py-4">Sin datos</div>
              ) : (
                metrics.recentDeals.map((deal, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <span className={`text-sm font-semibold truncate ${deal.lost ? 'line-through text-muted-foreground' : ''}`}>{deal.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={deal.lost ? "outline" : "secondary"} className="text-[10px]">{deal.stage}</Badge>
                        {!deal.lost && <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1 rounded">Prob: {deal.prob}</span>}
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold ${deal.lost ? 'text-muted-foreground' : ''}`}>{deal.value}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <div className="p-4 border-t mt-auto">
            <Link href="/pipeline" passHref>
              <Button variant="ghost" className="w-full text-primary hover:bg-primary/10">
                Ver Pipeline Completo
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
