"use client";

import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart as RechartsLineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatChartDate, pivotTimeSeries, buildChartConfig } from "@/lib/chart-utils";
import { TimeseriesDataPoint } from "@/types/experiment";

interface ConvergenceChartProps {
  data: TimeseriesDataPoint[];
}

export default function ConvergenceChart({ data }: ConvergenceChartProps) {
  const chartData = useMemo(() => pivotTimeSeries(data), [data]);

  const variants = useMemo(() => {
    const v = new Set<string>();
    data.forEach((d) => v.add(d.label));
    return Array.from(v);
  }, [data]);

  const config = useMemo(() => buildChartConfig(variants), [variants]);

  return (
    <div className="w-full h-72">
      <ChartContainer config={config} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              dataKey="timeBucket" 
              tickFormatter={formatChartDate} 
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
            {variants.map((v) => (
              <Line 
                key={v} 
                type="monotone" 
                dataKey={v} 
                stroke={config[v]?.color as string} 
                strokeWidth={2}
                dot={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
