import { TimeseriesDataPoint } from "@/types/experiment";

export function formatChartPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const VARIANT_COLORS = CHART_COLORS;

export function pivotTimeSeries(data: TimeseriesDataPoint[]): Record<string, unknown>[] {
  const grouped = data.reduce((acc, curr) => {
    if (!acc[curr.timeBucket]) {
      acc[curr.timeBucket] = { timeBucket: curr.timeBucket };
    }
    (acc[curr.timeBucket] as Record<string, unknown>)[curr.label] = curr.conversionRate;
    return acc;
  }, {} as Record<string, Record<string, unknown>>);

  return Object.values(grouped).sort(
    (a, b) => new Date(a.timeBucket as string).getTime() - new Date(b.timeBucket as string).getTime()
  );
}

export function buildChartConfig(variants: string[]): Record<string, Record<string, unknown>> {
  const cfg: Record<string, Record<string, unknown>> = {};
  variants.forEach((v, idx) => {
    cfg[v] = {
      label: v,
      color: VARIANT_COLORS[idx % VARIANT_COLORS.length],
    };
  });
  return cfg;
}
