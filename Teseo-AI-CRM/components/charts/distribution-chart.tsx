"use client";

import React, { useMemo } from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CHART_COLORS } from "@/lib/chart-utils";
import { VariantStats } from "@/types/experiment";

interface DistributionChartProps {
  data: VariantStats[];
}

export default function DistributionChart({ data }: DistributionChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      name: d.label,
      conversionRate: d.conversionRate,
    }));
  }, [data]);

  const config = {
    conversionRate: {
      label: "Conversion Rate",
      color: CHART_COLORS[0],
    },
  };

  return (
    <div className="w-full h-72">
      <ChartContainer config={config} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tickFormatter={(val) => `${val}%`} 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar 
              dataKey="conversionRate" 
              fill={config.conversionRate.color} 
              radius={[4, 4, 0, 0]} 
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
