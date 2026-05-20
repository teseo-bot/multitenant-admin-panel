# RFC-017: Asset Studio Fase 4 — Conexión de Analíticas A/B con Gráficos Recharts

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-20 |
| **Estado** | ✅ COMPLETADO (Cierre Topológico 2026-04-20) |
| **Componente** | `crm-agentico-panel` → Route Group `(asset-studio)` |
| **Dependencias** | RFC-015 (Asset Studio Arch), ADR-113 (Data Layer), Fase 3 (UI/UX) |
| **Stack** | Next.js 14 App Router, TypeScript 5, Recharts 3.8, Shadcn/UI Chart, TanStack Query 5, Supabase |
| **Ubicación RFC** | `docs/` (Bóveda Documental — Ley Marcial Topológica vía TOPOLOGY.json) |

---

## 0. Contexto y Motivación

### Estado Actual (Post-Fase 3)

Las Fases 1-3 del Asset Studio construyeron:
- **Fase 1:** Schema SQL (6 tablas con RLS), tipos TypeScript, migraciones.
- **Fase 2:** API Route Handlers BFF, TanStack Query hooks (queries + mutations), Zustand store, utilidades.
- **Fase 3:** Componentes UI del editor de prompts (galería, editor con `{{vars}}` highlighting, timeline de versiones, diff viewer, variable panel, unsaved changes guard).

**Lo que falta (y motiva esta Fase 4):**
1. **Cero componentes de visualización de datos** — No existen `experiment-dashboard.tsx`, `experiment-stats-card.tsx`, `convergence-chart.tsx`, `traffic-split-slider.tsx`, `winner-badge.tsx`, `experiment-list.tsx`, ni `experiment-setup-dialog.tsx`.
2. **Cero páginas de experiments** — Las rutas `/prompts/[templateId]/experiments/` y `/prompts/[templateId]/experiments/[experimentId]/` no existen como páginas.
3. **El API endpoint de stats no agrega datos reales** — `GET /api/prompts/[templateId]/experiments/[experimentId]` devuelve experimento + variantes, pero **no agrega impressions** (no calcula `VariantStats`).
4. **Recharts instalado pero sin uso** — `recharts@3.8.1` está en `package.json` pero ningún componente lo importa.
5. **No existe `components/ui/chart.tsx`** — El wrapper de Shadcn para Recharts no está instalado.
6. **Variables CRUD y Documents UI** — Tampoco fueron creados en Fase 3, pero son secundarios a esta fase. Se documentan como Fase 4b.

### Objetivo de Fase 4

**Conectar las vistas de analíticas de A/B Experiments con gráficos Recharts para que el CRM consuma variables reales** — esto significa:

1. El API endpoint agrega `ab_impressions` en `VariantStats` reales.
2. Un nuevo endpoint de series temporales alimenta gráficos de convergencia.
3. Los componentes de charts y dashboards se crean e integran con datos vivos.
4. El setup wizard de experiments permite crear tests desde la UI.
5. Las páginas de routing se crean y componen todo.

---

## 1. Arquitectura de la Solución

### 1.1 Diagrama de Flujo de Datos

```
┌───────────────────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL)                                                │
│                                                                       │
│  ab_impressions ──┐                                                   │
│  ab_variants ─────┼──→ SQL Aggregation Queries                        │
│  ab_experiments ──┘         │                                         │
│                             ▼                                         │
│              ┌──────────────────────────┐                             │
│              │ API Route Handlers (BFF) │                             │
│              │  /experiments/[id]       │ → ExperimentDetail + VariantStats[]
│              │  /experiments/[id]/ts    │ → TimeSeriesPoint[]          │
│              └──────────┬───────────────┘                             │
└─────────────────────────┼─────────────────────────────────────────────┘
                          │ JSON
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                              │
│                                                                  │
│  TanStack Query Hooks                                            │
│  ├── useExperimentStats(templateId, experimentId)                │
│  │   → { experiment, variants, stats: VariantStats[] }           │
│  └── useExperimentTimeSeries(templateId, experimentId)  [NEW]    │
│      → TimeSeriesPoint[]                                         │
│                                                                  │
│  Recharts Components (via Shadcn Chart wrapper)                  │
│  ├── convergence-chart.tsx     → LineChart (rate over time)      │
│  ├── outcome-distribution.tsx  → BarChart (outcomes per variant) │
│  └── sentiment-gauge.tsx       → RadialBarChart (avg sentiment)  │
│                                                                  │
│  Dashboard Composition                                           │
│  ├── experiment-stats-card.tsx → KPI cards per variant           │
│  ├── experiment-dashboard.tsx  → Full dashboard page             │
│  └── experiment-list.tsx       → Table of experiments            │
│                                                                  │
│  Setup Wizard                                                    │
│  ├── experiment-setup-dialog.tsx → Multi-step dialog             │
│  └── traffic-split-slider.tsx    → Slider with sum=100 constraint│
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Capas Modificadas

| Capa | Cambio | Tipo |
|---|---|---|
| **SQL** | Nuevas funciones RPC para aggregation + timeseries | DB |
| **API** | Refactor `experiments/[experimentId]/route.ts` + nuevo `ts/route.ts` | API |
| **Types** | Nuevos tipos `TimeSeriesPoint`, `ExperimentWithStats` | Types |
| **Hooks** | Refactor `useExperimentStats`, nuevo `useExperimentTimeSeries` | Hook |
| **UI** | 10 componentes nuevos + Shadcn Chart install | UI |
| **Pages** | 2 páginas nuevas (experiment list + dashboard) | Page |

---

## 2. Cambios en la Capa de Datos

### 2.1 SQL: Función RPC para Aggregation de Stats

El endpoint actual hace 2 queries separadas sin agregar impressions. La agregación debe vivir en SQL para performance (las impressions pueden ser miles por experimento).

```sql
-- ═══════════════════════════════════════════════════════
-- Migración: 20260420100000_experiment_stats_rpc.sql
-- ═══════════════════════════════════════════════════════

-- Función RPC: Devuelve VariantStats[] para un experiment
CREATE OR REPLACE FUNCTION get_experiment_stats(p_experiment_id UUID)
RETURNS TABLE (
  variant_id       UUID,
  label            CHAR(1),
  version_id       UUID,
  version_number   INT,
  traffic_pct      INT,
  impressions      BIGINT,
  response_rate    NUMERIC(5,4),
  positive_rate    NUMERIC(5,4),
  meetings_booked  BIGINT,
  avg_sentiment    NUMERIC(5,3),
  avg_response_ms  NUMERIC(10,1),
  conversion_rate  NUMERIC(5,4)
)
LANGUAGE sql STABLE
AS $$
  SELECT
    v.id                                                       AS variant_id,
    v.label,
    v.version_id,
    pv.version_number,
    v.traffic_pct,
    COUNT(i.id)                                                AS impressions,
    COALESCE(
      COUNT(i.id) FILTER (WHERE i.outcome NOT IN ('no_response'))::NUMERIC
      / NULLIF(COUNT(i.id), 0), 0
    )                                                          AS response_rate,
    COALESCE(
      COUNT(i.id) FILTER (WHERE i.outcome IN ('positive_response','meeting_booked','deal_advanced'))::NUMERIC
      / NULLIF(COUNT(i.id), 0), 0
    )                                                          AS positive_rate,
    COUNT(i.id) FILTER (WHERE i.outcome = 'meeting_booked')    AS meetings_booked,
    COALESCE(AVG(i.sentiment_score), 0)                        AS avg_sentiment,
    COALESCE(AVG(i.response_time_ms), 0)                       AS avg_response_ms,
    COALESCE(
      COUNT(i.id) FILTER (WHERE i.outcome = 'meeting_booked')::NUMERIC
      / NULLIF(COUNT(i.id), 0), 0
    )                                                          AS conversion_rate
  FROM ab_variants v
  JOIN prompt_versions pv ON pv.id = v.version_id
  LEFT JOIN ab_impressions i ON i.variant_id = v.id
  WHERE v.experiment_id = p_experiment_id
  GROUP BY v.id, v.label, v.version_id, pv.version_number, v.traffic_pct
  ORDER BY v.label;
$$;

-- Función RPC: Devuelve time-series de response_rate por día por variante
CREATE OR REPLACE FUNCTION get_experiment_timeseries(
  p_experiment_id UUID,
  p_bucket TEXT DEFAULT 'day'  -- 'hour' | 'day' | 'week'
)
RETURNS TABLE (
  bucket      TIMESTAMPTZ,
  variant_id  UUID,
  label       CHAR(1),
  impressions BIGINT,
  response_rate NUMERIC(5,4)
)
LANGUAGE sql STABLE
AS $$
  SELECT
    date_trunc(p_bucket, i.created_at)  AS bucket,
    v.id                                AS variant_id,
    v.label,
    COUNT(i.id)                         AS impressions,
    COALESCE(
      COUNT(i.id) FILTER (WHERE i.outcome NOT IN ('no_response'))::NUMERIC
      / NULLIF(COUNT(i.id), 0), 0
    )                                   AS response_rate
  FROM ab_impressions i
  JOIN ab_variants v ON v.id = i.variant_id
  WHERE v.experiment_id = p_experiment_id
  GROUP BY 1, v.id, v.label
  ORDER BY 1, v.label;
$$;

-- Índices de soporte (si no existen)
CREATE INDEX IF NOT EXISTS idx_impressions_variant_created
  ON ab_impressions(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_impressions_outcome
  ON ab_impressions(variant_id, outcome);
```

### 2.2 Nuevos Tipos TypeScript

```typescript
// types/experiment.ts — EXTENSIONES (no reemplazar lo existente)

/** Punto de serie temporal para gráficos de convergencia */
export interface TimeSeriesPoint {
  bucket: string;          // ISO timestamp (truncado a day/hour/week)
  variantId: string;
  label: string;           // 'A' | 'B' | 'C'
  impressions: number;
  responseRate: number;    // 0-1
}

/** Response del endpoint de stats: experiment + variants enriched con stats */
export interface ExperimentWithStats {
  experiment: ABExperiment;
  variants: (ABVariant & { versionNumber: number; content: string })[];
  stats: VariantStats[];
}

/** Config para el Shadcn ChartContainer */
export interface ChartColorConfig {
  [variantLabel: string]: {
    label: string;
    color: string;
  };
}
```

---

## 3. Cambios en la Capa API

### 3.1 Refactor: `GET /api/prompts/[templateId]/experiments/[experimentId]`

El endpoint actual devuelve experiment + variants sin stats. Se refactoriza para incluir aggregated stats via RPC.

```typescript
// app/api/prompts/[templateId]/experiments/[experimentId]/route.ts
// REFACTOR: agregar stats aggregados

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; experimentId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Fetch experiment
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select('*')
    .eq('id', params.experimentId)
    .single();

  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });

  // 2. Fetch variants con version info
  const { data: variants, error: varError } = await supabase
    .from('ab_variants')
    .select('*, version:prompt_versions(version_number, content)')
    .eq('experiment_id', params.experimentId);

  if (varError) return NextResponse.json({ error: varError.message }, { status: 500 });

  // 3. Fetch aggregated stats via RPC
  const { data: stats, error: statsError } = await supabase
    .rpc('get_experiment_stats', { p_experiment_id: params.experimentId });

  if (statsError) {
    console.error('Stats RPC error:', statsError);
    // Non-fatal: return empty stats if RPC fails (experiment may have 0 impressions)
  }

  const result = {
    experiment,
    variants: variants.map(v => ({
      ...v,
      versionNumber: v.version?.version_number,
      content: v.version?.content,
    })),
    stats: (stats ?? []).map(s => ({
      variantId: s.variant_id,
      label: s.label,
      impressions: Number(s.impressions),
      responseRate: Number(s.response_rate),
      positiveRate: Number(s.positive_rate),
      meetingsBooked: Number(s.meetings_booked),
      avgSentiment: Number(s.avg_sentiment),
      avgResponseTimeMs: Number(s.avg_response_ms),
      conversionRate: Number(s.conversion_rate),
    })),
  };

  return NextResponse.json(result);
}
```

### 3.2 Nuevo Endpoint: `GET /api/prompts/[templateId]/experiments/[experimentId]/ts`

```typescript
// app/api/prompts/[templateId]/experiments/[experimentId]/ts/route.ts
// NEW: Time-series data para convergence charts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; experimentId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bucket = req.nextUrl.searchParams.get('bucket') ?? 'day';
  if (!['hour', 'day', 'week'].includes(bucket)) {
    return NextResponse.json({ error: 'Invalid bucket. Use hour|day|week.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_experiment_timeseries', {
    p_experiment_id: params.experimentId,
    p_bucket: bucket,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (data ?? []).map(d => ({
    bucket: d.bucket,
    variantId: d.variant_id,
    label: d.label,
    impressions: Number(d.impressions),
    responseRate: Number(d.response_rate),
  }));

  return NextResponse.json(points);
}
```

### 3.3 Extensión de Query Keys

```typescript
// lib/query-keys.ts — agregar dentro de experiments:
experiments: {
  // ... existentes ...
  timeSeries: (id: string) => ['experiments', id, 'timeseries'] as const,
},
```

### 3.4 Nuevo Hook: `useExperimentTimeSeries`

```typescript
// hooks/queries/use-experiment-timeseries.ts

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { TimeSeriesPoint } from '@/types/experiment';

async function fetchTimeSeries(
  templateId: string,
  experimentId: string,
  bucket: 'hour' | 'day' | 'week' = 'day'
): Promise<TimeSeriesPoint[]> {
  const res = await fetch(
    `/api/prompts/${templateId}/experiments/${experimentId}/ts?bucket=${bucket}`
  );
  if (!res.ok) throw new Error('Failed to fetch timeseries');
  return res.json();
}

export function useExperimentTimeSeries(
  templateId: string,
  experimentId: string,
  bucket: 'hour' | 'day' | 'week' = 'day'
) {
  return useQuery({
    queryKey: [...queryKeys.experiments.timeSeries(experimentId), bucket],
    queryFn: () => fetchTimeSeries(templateId, experimentId, bucket),
    enabled: !!templateId && !!experimentId,
    refetchInterval: 60_000, // Auto-refresh every minute for running experiments
  });
}
```

### 3.5 Refactor Hook: `useExperimentStats`

```typescript
// hooks/queries/use-experiment-stats.ts — REFACTOR
// Now returns ExperimentWithStats instead of just ExperimentDetail

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { ExperimentWithStats } from '@/types/experiment';

async function fetchExperimentWithStats(
  templateId: string,
  experimentId: string
): Promise<ExperimentWithStats> {
  const res = await fetch(
    `/api/prompts/${templateId}/experiments/${experimentId}`
  );
  if (!res.ok) throw new Error('Failed to fetch experiment stats');
  return res.json();
}

export function useExperimentStats(templateId: string, experimentId: string) {
  return useQuery({
    queryKey: queryKeys.experiments.detail(experimentId),
    queryFn: () => fetchExperimentWithStats(templateId, experimentId),
    enabled: !!templateId && !!experimentId,
    refetchInterval: (query) => {
      // Auto-refresh only for running experiments
      const status = query.state.data?.experiment?.status;
      return status === 'running' ? 30_000 : false;
    },
  });
}
```

---

## 4. Componentes UI — Arquitectura de Charts

### 4.1 Paso Previo: Instalar Shadcn Chart

Shadcn/UI provee un wrapper (`chart.tsx`) que estandariza `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` sobre Recharts. Esto garantiza consistencia visual con el design system.

```bash
npx shadcn@latest add chart
```

Esto crea `components/ui/chart.tsx` con el theming integrado.

### 4.2 Mapa de Color por Variante

```typescript
// lib/chart-utils.ts

import type { ChartColorConfig } from '@/types/experiment';

/** Colores consistentes para variantes A/B/C */
export const VARIANT_COLORS: Record<string, string> = {
  A: 'hsl(var(--chart-1))',  // Blue (Shadcn chart-1)
  B: 'hsl(var(--chart-2))',  // Green (Shadcn chart-2)
  C: 'hsl(var(--chart-3))',  // Orange (Shadcn chart-3)
  D: 'hsl(var(--chart-4))',  // Purple (Shadcn chart-4)
};

export function buildChartConfig(
  labels: string[]
): ChartColorConfig {
  return Object.fromEntries(
    labels.map(label => [
      label,
      {
        label: `Variant ${label}`,
        color: VARIANT_COLORS[label] ?? 'hsl(var(--chart-5))',
      },
    ])
  );
}

/** Transforma TimeSeriesPoint[] en formato pivotado para Recharts */
export function pivotTimeSeries(
  points: { bucket: string; label: string; responseRate: number; impressions: number }[]
): Record<string, unknown>[] {
  const byBucket = new Map<string, Record<string, unknown>>();

  for (const p of points) {
    if (!byBucket.has(p.bucket)) {
      byBucket.set(p.bucket, { date: p.bucket });
    }
    const row = byBucket.get(p.bucket)!;
    row[`rate_${p.label}`] = +(p.responseRate * 100).toFixed(1);
    row[`n_${p.label}`] = p.impressions;
  }

  return [...byBucket.values()].sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  );
}
```

### 4.3 Árbol de Componentes Nuevos

```
components/asset-studio/
├── ─── A/B EXPERIMENTS (FASE 4 — NUEVOS) ───
│   ├── experiment-list.tsx             # Tabla de experiments del template
│   ├── experiment-setup-dialog.tsx     # Wizard multi-step para crear experiment
│   ├── experiment-dashboard.tsx        # Composición del dashboard completo
│   ├── experiment-stats-card.tsx       # Card KPI de una variante
│   ├── traffic-split-slider.tsx        # Slider con constraint sum=100
│   ├── winner-badge.tsx                # Badge dinámico por estado
│   ├── convergence-chart.tsx           # Recharts LineChart (rate over time)
│   ├── outcome-distribution-chart.tsx  # Recharts BarChart (outcomes)
│   └── experiment-actions-bar.tsx      # Barra de acciones (Start/Pause/End/Cancel)
```

### 4.4 Contratos de Props Detallados

#### `convergence-chart.tsx` — El Chart Principal

```typescript
'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent,
} from '@/components/ui/chart';
import { useExperimentTimeSeries } from '@/hooks/queries/use-experiment-timeseries';
import { buildChartConfig, pivotTimeSeries, VARIANT_COLORS } from '@/lib/chart-utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

interface ConvergenceChartProps {
  templateId: string;
  experimentId: string;
  variantLabels: string[];    // ['A', 'B'] or ['A', 'B', 'C']
}

// Renders a LineChart showing response rate convergence over time per variant.
// Uses Shadcn ChartContainer for consistent theming.
// Includes bucket selector (hour/day/week).
// Auto-refreshes via hook's refetchInterval.
```

**Datos consumidos:**
- `useExperimentTimeSeries(templateId, experimentId, bucket)` → `TimeSeriesPoint[]`
- Transformados via `pivotTimeSeries()` en formato `{ date, rate_A, rate_B, n_A, n_B }`
- Cada variante es una `<Line>` con color de `VARIANT_COLORS`

**Interactividad:**
- Selector de bucket (hour/day/week) cambia granularidad
- Tooltip muestra: fecha, rate por variante, N impressions
- Legend con labels de variante

#### `outcome-distribution-chart.tsx` — Distribución de Outcomes

```typescript
interface OutcomeDistributionChartProps {
  stats: VariantStats[];
  variantLabels: string[];
}

// Recharts stacked BarChart:
// X: variante (A, B, C)
// Y: count per outcome category
// Stacks: response, positive_response, meeting_booked, etc.
// Colorea según outcome severity (green → meetings, yellow → response, red → no_response)
```

**Datos consumidos:**
- `stats: VariantStats[]` del hook `useExperimentStats`
- Derivados: para cada variante, calcular counts estimados de cada outcome usando rates × impressions

#### `experiment-stats-card.tsx` — Card de KPIs

```typescript
interface ExperimentStatsCardProps {
  stats: VariantStats;
  variant: ABVariant & { versionNumber: number };
  isWinner: boolean;
  isLeading: boolean;           // Tiene el mejor response rate entre variantes activas
}

// Layout:
// Header: "Variant {label} — v{versionNumber}" + WinnerBadge (si aplica)
// Grid 2x3 de KPIs:
//   impressions (number)
//   response rate (% con trend indicator)
//   positive rate (%)
//   meetings booked (number)
//   avg sentiment (bar -1 to 1)
//   avg response time (humanized)
// Border highlight si isLeading
```

#### `experiment-dashboard.tsx` — Composición Principal

```typescript
interface ExperimentDashboardProps {
  templateId: string;
  experimentId: string;
}

// Composición:
// 1. useExperimentStats(templateId, experimentId) → { experiment, variants, stats }
// 2. Header: experiment.name + StatusBadge + date range
// 3. Grid: ExperimentStatsCard × N (una por variante)
// 4. ConvergenceChart (ocupa full width)
// 5. OutcomeDistributionChart (below chart)
// 6. ExperimentActionsBar (fixed bottom o inline)
//
// Loading: Skeleton layout (3 card skeletons + chart skeleton)
// Empty: si stats[].impressions === 0 → "No impressions yet. Data will appear once the experiment receives traffic."
```

#### `experiment-setup-dialog.tsx` — Wizard de Creación

```typescript
interface ExperimentSetupDialogProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 4 Steps:
// Step 1: Name + min_impressions (number, default 100) + confidence_level (slider 0.90-0.99)
// Step 2: Select versions (checkboxes on PromptVersion cards, min 2 max 4)
//         → usePromptVersions(templateId), filter status !== 'archived'
// Step 3: Traffic split → TrafficSplitSlider
// Step 4: Review summary (read-only) → Create button
//
// Submit: useCreateExperiment mutation → navigate to dashboard
// Validation: Zod schema per step, "Next" disabled until valid
```

#### `traffic-split-slider.tsx`

```typescript
interface TrafficSplitSliderProps {
  variants: { label: string; versionId: string }[];
  values: number[];               // % per variant, sum = 100
  onChange: (values: number[]) => void;
}

// For 2 variants: single Shadcn Slider, B = 100 - A
// For 3+ variants: linked sliders with auto-adjust of last variant
// Visual: segmented horizontal bar showing proportional colors
// Constraints: min 10% per variant, increments of 5, sum always 100
// "Equal Split" button → divides evenly
```

#### `winner-badge.tsx`

```typescript
interface WinnerBadgeProps {
  status: 'winner' | 'loser' | 'running' | 'paused' | 'cancelled' | 'leading';
}
// winner   → 🏆 Badge variant="default" bg-emerald
// loser    → Badge variant="outline" text-muted-foreground
// running  → Badge variant="secondary" bg-blue + pulse animation
// paused   → Badge variant="outline" bg-amber
// leading  → Badge variant="secondary" bg-blue (no pulse, subtle)
// cancelled → Badge variant="outline" text-muted line-through
```

#### `experiment-actions-bar.tsx`

```typescript
interface ExperimentActionsBarProps {
  experiment: ABExperiment;
  stats: VariantStats[];
  templateId: string;
}

// Renders action buttons based on experiment.status:
// draft     → [Start Experiment ▶]
// running   → [Pause ⏸] [Declare Winner →] [Cancel ✕]
// paused    → [Resume ▶] [Declare Winner →] [Cancel ✕]
// completed → [Promote Winner ↑] (→ calls usePromoteVersion with winner's version)
// cancelled → (no actions, read-only state)
//
// "Declare Winner" → opens ConfirmDialog listing variants, operator picks one
// All actions use existing mutations: useControlExperiment, useDeclareWinner
//
// Warning: if any variant has impressions < min_impressions, 
// show amber tooltip on "Declare Winner": "Statistical significance not reached"
```

#### `experiment-list.tsx`

```typescript
interface ExperimentListProps {
  templateId: string;
}

// Uses useExperiments(templateId)
// Table columns: name, status (WinnerBadge logic), # variants, total impressions, created_at, →
// Row click: navigate to /prompts/[templateId]/experiments/[experimentId]
// Empty: EmptyState with "No experiments yet — start your first A/B test"
// Header: [+ New A/B Test] → opens ExperimentSetupDialog
```

---

## 5. Páginas y Routing

### 5.1 Nuevas Páginas

```
app/(asset-studio)/
└── prompts/
    └── [templateId]/
        └── experiments/
            ├── page.tsx                     # [CREAR] Experiment list
            └── [experimentId]/
                └── page.tsx                 # [CREAR] Experiment dashboard
```

#### `experiments/page.tsx`

```typescript
import { ExperimentList } from '@/components/asset-studio/experiment-list';
import { ExperimentSetupDialog } from '@/components/asset-studio/experiment-setup-dialog';

interface Props { params: { templateId: string } }

export default function ExperimentsPage({ params }: Props) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">A/B Experiments</h2>
          <p className="text-muted-foreground">
            Test prompt variants and measure performance
          </p>
        </div>
      </div>
      <ExperimentList templateId={params.templateId} />
    </div>
  );
}
```

#### `experiments/[experimentId]/page.tsx`

```typescript
import { ExperimentDashboard } from '@/components/asset-studio/experiment-dashboard';

interface Props { params: { templateId: string; experimentId: string } }

export default function ExperimentDashboardPage({ params }: Props) {
  return <ExperimentDashboard templateId={params.templateId} experimentId={params.experimentId} />;
}
```

### 5.2 Wiring en el Editor

El `editor-toolbar.tsx` existente tiene un botón `🧪 New A/B Test`. Este debe:
1. Navegar a `/prompts/[templateId]/experiments` si experiments existen.
2. Abrir `ExperimentSetupDialog` directamente si es la primera vez.

---

## 6. Principios de Diseño Aplicados

### 6.1 SOLID en Fase 4

| Principio | Aplicación |
|---|---|
| **S** — SRP | `convergence-chart` solo renderiza el LineChart. `pivotTimeSeries()` en `chart-utils.ts` transforma datos. `useExperimentTimeSeries` solo fetches. Ningún componente hace fetch + transform + render. |
| **O** — OCP | Agregar un chart nuevo (ej. sentiment-over-time) solo requiere crear el componente y añadirlo al dashboard. No toca `experiment-dashboard.tsx` gracias a composición. |
| **L** — LSP | Todos los charts usan `ChartContainer` de Shadcn, intercambiables dentro del dashboard grid. |
| **I** — ISP | El hook `useExperimentTimeSeries` existe separado de `useExperimentStats` — el dashboard los usa a ambos pero la experiment-list solo necesita stats. |
| **D** — DIP | Los charts dependen de `VariantStats` y `TimeSeriesPoint` (tipos abstractos), no de la forma raw de Supabase. La transformación ocurre en la API layer. |

### 6.2 DRY

| Patrón | Implementación |
|---|---|
| Color mapping | `VARIANT_COLORS` + `buildChartConfig()` centralizados en `lib/chart-utils.ts` |
| Data pivoting | `pivotTimeSeries()` reutilizable para cualquier time-series by-variant |
| Status badges | `winner-badge.tsx` reutilizable en list, dashboard, y stats-card |
| Aggregation | SQL RPC functions en vez de duplicar lógica de conteo en JS |

---

## 7. WBS — Desglose de Tareas

### Sprint 4.1 — Data Layer (1.5 días) ✅ COMPLETADO

| # | Tarea | Tipo | Deps | Est. | Archivo | Estado |
|---|---|---|---|---|---|---|
| 4.1.1 | Crear migración SQL: `get_experiment_stats` RPC + `get_experiment_timeseries` RPC + índices | DB | — | 3h | `supabase/migrations/20260420100000_experiment_stats_rpc.sql` | ✅ |
| 4.1.2 | Extender `types/experiment.ts`: `TimeSeriesPoint`, `ExperimentWithStats`, `ChartColorConfig` | Types | — | 30min | `crm-agentico-panel/types/experiment.ts` | ✅ |
| 4.1.3 | Refactor API: `experiments/[experimentId]/route.ts` — agregar stats via RPC | API | 4.1.1 | 2h | `app/api/prompts/[templateId]/experiments/[experimentId]/route.ts` | ✅ |
| 4.1.4 | Nuevo API: `experiments/[experimentId]/ts/route.ts` — timeseries endpoint | API | 4.1.1 | 1.5h | `app/api/.../ts/route.ts` | ✅ |
| 4.1.5 | Refactor hook: `use-experiment-stats.ts` — return `ExperimentWithStats`, conditional refetch | Hook | 4.1.3 | 1h | `hooks/queries/use-experiment-stats.ts` | ✅ |
| 4.1.6 | Nuevo hook: `use-experiment-timeseries.ts` | Hook | 4.1.4 | 1h | `hooks/queries/use-experiment-timeseries.ts` | ✅ |
| 4.1.7 | Extender `lib/query-keys.ts` con `experiments.timeSeries` | Lib | — | 10min | `lib/query-keys.ts` | ✅ |
| 4.1.8 | Crear `lib/chart-utils.ts` — `VARIANT_COLORS`, `buildChartConfig`, `pivotTimeSeries` | Lib | 4.1.2 | 1h | `lib/chart-utils.ts` | ✅ |

**Subtotal: ~10h — COMPLETADO**

### Sprint 4.2 — Shadcn Chart + Componentes Base (1.5 días) ✅ COMPLETADO

| # | Tarea | Tipo | Deps | Est. | Archivo | Estado |
|---|---|---|---|---|---|---|
| 4.2.1 | `npx shadcn@latest add chart` — instalar Shadcn Chart wrapper | Setup | — | 10min | `components/ui/chart.tsx` | ✅ |
| 4.2.2 | Instalar componentes Shadcn faltantes: `slider`, `select`, `switch`, `form`, `label` | Setup | — | 10min | `components/ui/` | ✅ |
| 4.2.3 | `winner-badge.tsx` — badge dinámico con 6 estados | UI | — | 45min | `components/asset-studio/winner-badge.tsx` | ✅ |
| 4.2.4 | `traffic-split-slider.tsx` — slider con sum=100 constraint | UI | 4.2.2 | 3h | `components/asset-studio/traffic-split-slider.tsx` | ✅ |
| 4.2.5 | `experiment-stats-card.tsx` — card de KPIs por variante | UI | 4.2.3 | 2.5h | `components/asset-studio/experiment-stats-card.tsx` | ✅ |
| 4.2.6 | `convergence-chart.tsx` — Recharts LineChart con Shadcn wrapper | UI | 4.2.1, 4.1.8 | 3.5h | `components/asset-studio/convergence-chart.tsx` | ✅ |
| 4.2.7 | `outcome-distribution-chart.tsx` — Recharts BarChart | UI | 4.2.1, 4.1.8 | 2.5h | `components/asset-studio/outcome-distribution-chart.tsx` | ✅ |
| 4.2.8 | `experiment-actions-bar.tsx` — barra contextual de acciones | UI | 4.2.3 | 2h | `components/asset-studio/experiment-actions-bar.tsx` | ✅ |

**Subtotal: ~14.5h — COMPLETADO**

### Sprint 4.3 — Dashboard y Wizard (2 días) ✅ COMPLETADO

| # | Tarea | Tipo | Deps | Est. | Archivo | Estado |
|---|---|---|---|---|---|---|
| 4.3.1 | `experiment-setup-dialog.tsx` — wizard 4 pasos | UI | 4.2.4 | 5h | `components/asset-studio/experiment-setup-dialog.tsx` | ✅ |
| 4.3.2 | `experiment-list.tsx` — tabla de experiments | UI | 4.2.3 | 2.5h | `components/asset-studio/experiment-list.tsx` | ✅ |
| 4.3.3 | `experiment-dashboard.tsx` — composición completa | UI | 4.2.5-4.2.8, 4.1.5-4.1.6 | 4h | `components/asset-studio/experiment-dashboard.tsx` | ✅ |
| 4.3.4 | Page: `experiments/page.tsx` — lista + setup trigger | Page | 4.3.1, 4.3.2 | 1h | `app/(asset-studio)/prompts/[templateId]/experiments/page.tsx` | ✅ |
| 4.3.5 | Page: `experiments/[experimentId]/page.tsx` — dashboard | Page | 4.3.3 | 45min | `app/(asset-studio)/.../[experimentId]/page.tsx` | ✅ |
| 4.3.6 | Wire `editor-toolbar.tsx` — botón 🧪 navega/abre setup | UI | 4.3.4 | 45min | `components/asset-studio/editor-toolbar.tsx` | ✅ |

**Subtotal: ~14h — COMPLETADO**

### Sprint 4.4 — Polish, Skeletons y Edge Cases (1 día) ✅ COMPLETADO

| # | Tarea | Tipo | Deps | Est. | Archivo | Estado |
|---|---|---|---|---|---|---|
| 4.4.1 | Skeleton loaders: dashboard (3 card + chart skeleton), list (table rows) | UI | All | 2h | Inline | ✅ |
| 4.4.2 | Empty states: experiment list, dashboard con 0 impressions, timeseries vacía | UI | All | 1.5h | Inline | ✅ |
| 4.4.3 | `loading.tsx` para `experiments/` y `experiments/[experimentId]/` | Page | — | 30min | `loading.tsx` × 2 | ✅ |
| 4.4.4 | `error.tsx` para ambas rutas (error boundary) | Page | — | 30min | `error.tsx` × 2 | ✅ |
| 4.4.5 | Toast notifications para: create experiment, start, pause, end, cancel, declare winner | UX | — | 1h | Wiring en mutations | ✅ |
| 4.4.6 | Responsive breakpoints: dashboard → stack cards en mobile, chart 100% width | UI | 4.3.3 | 1h | Tailwind classes | ✅ |
| 4.4.7 | Auto-refresh indicator: badge "Live" pulsante cuando experiment is running | UI | 4.1.5 | 30min | `experiment-dashboard.tsx` | ✅ |

**Subtotal: ~7h — COMPLETADO**

---

## 8. Resumen de Esfuerzo

| Sprint | Descripción | Estimación | Estado |
|---|---|---|---|
| 4.1 | Data Layer (SQL RPC, API refactor, hooks, utils) | ~10h | ✅ COMPLETADO |
| 4.2 | Shadcn Chart + Componentes Base | ~14.5h | ✅ COMPLETADO |
| 4.3 | Dashboard y Wizard (composición + páginas) | ~14h | ✅ COMPLETADO |
| 4.4 | Polish, Skeletons y Edge Cases | ~7h | ✅ COMPLETADO |
| **Total** | | **~45.5h (~6 días dev, ~1.5 semanas)** | ✅ **FASE 4 CERRADA** |

---

## 9. Orden de Ejecución

```
4.1 (Data Layer) → 4.2 (Charts + Base) → 4.3 (Dashboard + Wizard) → 4.4 (Polish)
     ↓                     ↓                        ↓                      ↓
 Stats reales       Charts renderizan         Todo conectado          Producción
 en el API          con datos reales          end-to-end              ready
```

**Regla:** No empezar 4.2 sin que la migración SQL (4.1.1) y el refactor del API (4.1.3) estén funcionando — los charts necesitan datos reales para testing.

---

## 10. Dependencias Nuevas

```bash
# En crm-agentico-panel/
npx shadcn@latest add chart slider select switch form label

# No se requieren dependencias npm adicionales —
# recharts@3.8.1 ya está instalado
# jsdiff ya está instalado (Fase 3)
```

---

## 11. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **RPC functions no desplegadas** — si Supabase local no tiene las funciones, stats devuelve `[]` | Alto — charts vacíos | El API handle es graceful (non-fatal si RPC falla). Crear seed script con impressions de test. |
| **Timeseries vacía al inicio** — experiment recién creado no tiene datos | Medio — UX confusa | Empty state: "Waiting for first impressions…" con ilustración. No renderizar chart vacío. |
| **Significancia estadística falsa** — operador declara winner con N < min_impressions | Alto — decisión incorrecta | `experiment-actions-bar` muestra warning amber si `any variant.impressions < experiment.minImpressions`. "Declare Winner" requiere ConfirmDialog extra con el warning. |
| **Race condition: experiment status transitions** — dos operadores intentan start/pause simultáneamente | Bajo — state inconsistency | Server-side: el API Route verifica `experiment.status` antes de transicionar. Usa `update ... where status = expected_status`. Client: invalidateQueries post-mutation. |
| **Bundle size de Recharts** — Recharts es ~200KB gzipped | Medio — First Load JS | Dynamic import con `next/dynamic` y `ssr: false` para todos los chart components. Solo se cargan en la experiment dashboard route. |
| **Supabase RPC response shape** — `supabase.rpc()` puede devolver snake_case o tipos inesperados | Medio — runtime error | Transformación explícita en el API route (`.map()` con `Number()` casts). Types fuerzan el contrato. |

---

## 12. Reglas para el Ejecutor

### DO
1. **Usar Shadcn `ChartContainer`** para todos los charts — no Recharts raw. Esto garantiza theming consistente (dark mode, colors).
2. **Usar `supabase.rpc()`** para aggregation — no hacer `COUNT/AVG` en JavaScript.
3. **Dynamic import** para todos los chart components (`next/dynamic({ ssr: false })`).
4. **Reutilizar `lib/chart-utils.ts`** — no hardcodear colores ni transformaciones en componentes.
5. **Verificar firma de `useExperimentStats(templateId, experimentId)`** — requiere 2 parámetros (corrección documentada en `AssetStudio_Fase3_ValidationReport.md`).
6. **Crear seed data** — insertar impressions de prueba para poder visualizar charts durante desarrollo.

### DON'T
1. **NO instalar chart libraries adicionales** (Nivo, Tremor, Victory). Recharts + Shadcn Chart es suficiente.
2. **NO hacer aggregation en el frontend** — toda la lógica de stats vive en SQL RPCs.
3. **NO hardcodear colores** — usar `VARIANT_COLORS` de `chart-utils.ts` y Shadcn CSS variables.
4. **NO poner datos de timeseries en Zustand** — viven en TanStack Query cache con `refetchInterval`.
5. **NO crear nuevas tablas** — el schema de Fase 1 es suficiente. Solo se agregan RPC functions e índices.
6. **NO skip empty states** — un chart sin datos es peor que un mensaje claro de "waiting for data".

---

## 13. Apéndice A: Seed Script para Desarrollo

```sql
-- seed-experiment-data.sql
-- Insertar después de tener al menos un experiment creado

-- Asume que ya existe un experiment con variantes A y B
-- Reemplazar UUIDs con los reales de tu entorno

DO $$
DECLARE
  v_variant_a UUID := '00000000-0000-0000-0000-000000000001'; -- Reemplazar
  v_variant_b UUID := '00000000-0000-0000-0000-000000000002'; -- Reemplazar
  v_outcomes  ab_outcome[] := ARRAY[
    'no_response','response','positive_response',
    'meeting_booked','deal_advanced','objection'
  ]::ab_outcome[];
  i INT;
BEGIN
  FOR i IN 1..500 LOOP
    INSERT INTO ab_impressions (variant_id, thread_id, lead_id, outcome, sentiment_score, response_time_ms, created_at)
    VALUES (
      CASE WHEN random() < 0.5 THEN v_variant_a ELSE v_variant_b END,
      gen_random_uuid(),
      gen_random_uuid(),
      v_outcomes[1 + floor(random() * array_length(v_outcomes, 1))::int],
      (random() * 2 - 1)::numeric(4,3),
      (random() * 86400000)::int,  -- 0-24h in ms
      now() - (random() * interval '14 days')
    );
  END LOOP;
END $$;
```

---

## 14. Apéndice B: Fase 4b — Variables CRUD UI y Documents UI

Estos componentes fueron planificados en Fase 3 WBS pero no implementados. Se recomienda abordarlos inmediatamente después de Fase 4:

| Componente | Estimación | Prioridad |
|---|---|---|
| `variable-form.tsx` + `variables/page.tsx` | ~6h | Alta (el variable panel del editor ya depende de variables definidas) |
| `document-table.tsx` + `upload-dropzone.tsx` + `chunk-viewer.tsx` + pages | ~12.5h | Media (RAG pipeline aún no conectado) |

---

---

## 15. Registro de Cierre Topológico

| Campo | Valor |
|---|---|
| **Fecha de Cierre** | 2026-04-20 |
| **Cerrado por** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Estado Final** | ✅ COMPLETADO — Todos los sprints (4.1–4.4) ejecutados |
| **Resolución Técnica** | Inyección higienizada del parámetro `timeseries` (`p_bucket`) a Supabase RPC (validación server-side contra allowlist `['hour','day','week']`, sin interpolación directa en SQL). Eliminación de `any` en TypeScript: todos los tipos de retorno de `supabase.rpc()` mapeados explícitamente a interfaces tipadas (`VariantStats`, `TimeSeriesPoint`, `ExperimentWithStats`) con casting `Number()` en la capa API. |
| **Próximos pasos** | Fase 4b (Variables CRUD UI + Documents UI) según Apéndice B |

---

*Builder (Arquitecto Staff) — Escuadrón Teseo | RFC-017-Asset-Studio-Phase4-Analytics-Charts v1.1 (Cierre Topológico) | 2026-04-20*
*Escrito en la Bóveda Documental (`docs/`) conforme a TOPOLOGY.json — Ley Marcial Documental y Topológica.*
