"use client"

import { useFinOpsSummary } from "@/hooks/use-finops-summary"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Activity, Database, TrendingUp } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

const MODEL_COLORS: Record<string, string> = {
  "gemini-2.5-flash": "hsl(var(--chart-1))",
  "gemini-1.5-pro": "hsl(var(--chart-2))",
  "claude-3-5-sonnet": "hsl(var(--chart-3))",
  "gpt-4o-mini": "hsl(var(--chart-4))",
  "default": "hsl(var(--primary))"
};

export function FinOpsDashboard() {
  const { data, isLoading, isError, error } = useFinOpsSummary()

  if (isError) {
    return (
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive text-sm">
        Error loading financial data: {error.message}
      </div>
    )
  }

  // Calculate aggregated totals from the array of summaries
  const totalCost = data?.reduce((acc, row) => acc + Number(row.total_cost_usd), 0) || 0
  const totalTokens = data?.reduce((acc, row) => acc + Number(row.total_input_tokens) + Number(row.total_output_tokens), 0) || 0
  const totalRequests = data?.reduce((acc, row) => acc + Number(row.total_requests), 0) || 0

  // Format data for Model Breakdown Chart
  const modelBreakdownData = data ? data.map(row => ({
    name: row.model_name,
    cost: Number(Number(row.total_cost_usd).toFixed(4)),
    requests: Number(row.total_requests)
  })).sort((a, b) => b.cost - a.cost) : [];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total Estimated Cost"
          value={`$${totalCost.toFixed(4)}`}
          icon={<DollarSign className="w-4 h-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Total Tokens Processed"
          value={totalTokens.toLocaleString()}
          icon={<Database className="w-4 h-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Agent Requests"
          value={totalRequests.toLocaleString()}
          icon={<Activity className="w-4 h-4 text-muted-foreground" />}
          isLoading={isLoading}
        />
      </div>

      <Card className="border-muted/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Desglose de Costos por Modelo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Costo en USD consolidado para la capa de enrutamiento (Gatekeeper), RAG y Agente Principal.
          </p>
        </CardHeader>
        <CardContent className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Skeleton className="w-full h-full rounded-md" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelBreakdownData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12}} dx={-10} tickFormatter={(value) => `$${value}`} />
                <RechartsTooltip 
                  cursor={{fill: "hsl(var(--muted)/0.4)"}}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  formatter={(value: unknown) => [`$${Number(value).toFixed(4)}`, "Costo USD"]}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {modelBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={MODEL_COLORS[entry.name] || MODEL_COLORS["default"]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ title, value, icon, isLoading }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-24 h-8" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
