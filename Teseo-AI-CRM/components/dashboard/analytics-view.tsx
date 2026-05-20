"use client";

import { useAnalytics, AnalyticsPayload, LeadsByStatus } from "@/hooks/queries/use-analytics";
import { AnalyticsSkeleton } from "./analytics-skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, DollarSign, Megaphone, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";

const COLORS = {
  New: "hsl(var(--chart-1))",
  Contacted: "hsl(var(--chart-2))",
  Qualified: "hsl(var(--chart-3))",
  Won: "hsl(var(--chart-5))",
  Lost: "hsl(var(--chart-4))",
};

export function AnalyticsView() {
  const { data, isLoading, isError } = useAnalytics();

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Error cargando las métricas analíticas empresariales.
      </div>
    );
  }

  const { conversionMetrics: metrics, leadsByStatus: statusDistribution, timeseries } = data as AnalyticsPayload & { timeseries?: any[] };

  // Transform distribution into a funnel/pipeline array
  const pipelineOrder = ["New", "Contacted", "Qualified", "Won"];
  const pipelineData = pipelineOrder.map(status => {
    const found = statusDistribution.find((d: LeadsByStatus) => d.status === status);
    return { name: status, value: found ? found.total : 0 };
  });

  // Data for timeseries from API
  const marketingData = timeseries && timeseries.length > 0 ? timeseries : [
    { name: "Jan", leads: 0, cpa: 0 }
  ];

  return (
    <div className="flex flex-col gap-6 w-full h-full p-4 md:p-6 overflow-y-auto pb-12">
      {/* Nivel 1: KPIs Ejecutivos (Ventas & Marketing) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value (ARR)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.won_leads > 0 ? (metrics.won_leads * 12500).toLocaleString() : "0"}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              Valor estimado de cierre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate General</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avg_conversion_rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">De Contacted a Won</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo por Adquisición (CPA)</CardTitle>
            <Megaphone className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${timeseries && timeseries.length > 0 ? timeseries[timeseries.length - 1].cpa.toFixed(2) : "0.00"}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              Promedio mes actual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
            <Clock className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-1">Requiere más datos históricos</p>
          </CardContent>
        </Card>
      </div>

      {/* Nivel 2: Gráficos Enterprise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sales Pipeline (Funnel) */}
        <Card className="col-span-1 border-muted/50 shadow-sm">
          <CardHeader>
            <CardTitle>Sales Pipeline Analytics</CardTitle>
            <CardDescription>Embudo de conversión de la fuerza de ventas y SDR (Agentes)</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: "hsl(var(--foreground))", fontSize: 12}} width={80} />
                <RechartsTooltip 
                  cursor={{fill: "hsl(var(--muted)/0.4)"}}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Marketing Lead Generation Trend */}
        <Card className="col-span-1 border-muted/50 shadow-sm">
          <CardHeader>
            <CardTitle>Lead Generation & Marketing</CardTitle>
            <CardDescription>Evolución de volumen de captación y optimización de costo</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marketingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12}} dx={-10} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                />
                <Area type="monotone" dataKey="leads" stroke="hsl(var(--chart-2))" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
