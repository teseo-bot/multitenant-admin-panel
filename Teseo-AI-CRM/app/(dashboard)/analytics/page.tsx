'use client';

import { useAnalytics } from '@/hooks/queries/use-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Target, Activity, CheckCircle2 } from 'lucide-react';

export default function AnalyticsDashboard() {
  const { data, isLoading, isError } = useAnalytics();

  if (isError) {
    return (
      <div className="p-8 w-full flex justify-center text-destructive">
        Error al cargar los datos analíticos.
      </div>
    );
  }

  const { conversionMetrics, leadsByStatus } = data || {};

  return (
    <div className="p-8 w-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard General</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{conversionMetrics?.total_leads}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{conversionMetrics?.avg_conversion_rate}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Ganados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{conversionMetrics?.won_leads}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Perdidos</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{conversionMetrics?.lost_leads}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribution Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Distribución de Estados</CardTitle>
          </CardHeader>
          <CardContent>
             {isLoading ? (
               <Skeleton className="h-[200px] w-full" />
             ) : (
               <div className="space-y-4">
                 {leadsByStatus?.map((item) => (
                    <div key={item.status} className="flex items-center justify-between">
                      <div className="text-sm font-medium capitalize">{item.status.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground font-mono">{item.total}</div>
                    </div>
                 ))}
                 {(!leadsByStatus || leadsByStatus.length === 0) && (
                   <p className="text-sm text-muted-foreground text-center py-8">Sin datos de distribución</p>
                 )}
               </div>
             )}
          </CardContent>
        </Card>
        {/* Placeholder for future Recharts integration */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Comportamiento Reciente</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
             [Gráfica en Fase Siguiente]
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
