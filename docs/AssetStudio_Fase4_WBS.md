# Asset Studio — Fase 4: Analíticas A/B + Gráficos Recharts (WBS)

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-20 |
| **Estado** | Draft — Plan Maestro para Ejecutor |
| **RFC Origen** | RFC-017-Asset-Studio-Phase4-Analytics-Charts.md |
| **Prerrequisitos** | Fase 1 (BD + Types) ✅, Fase 2 (APIs + Hooks + Store) ✅, Fase 3 (UI Prompts) ✅ |
| **Stack** | Next.js 14, TypeScript 5, Recharts 3.8, Shadcn/UI Chart, TanStack Query 5, Supabase RPC |

---

## 0. Inventario — Lo que Existe vs Lo que Falta

### ✅ Ya Implementado (NO recrear)

| Componente | Ubicación |
|---|---|
| Schema SQL (6 tablas + RLS + ENUMs) | `supabase/migrations/20260420000000_asset_studio_schema.sql` |
| Tipos: `ABExperiment`, `ABVariant`, `ABImpression`, `VariantStats` | `types/experiment.ts` |
| API: CRUD experiments + start/pause/end/cancel | `app/api/prompts/[templateId]/experiments/**` |
| Hooks queries: `useExperiments`, `useExperimentStats` | `hooks/queries/use-experiment*.ts` |
| Hooks mutations: `useCreateExperiment`, `useControlExperiment`, `useDeclareWinner` | `hooks/mutations/use-*-experiment.ts`, `use-declare-winner.ts` |
| Query keys: `experiments.*` | `lib/query-keys.ts` |
| Zustand store | `stores/asset-studio-store.ts` |
| Recharts `^3.8.1` | `package.json` (instalado, sin uso) |
| UI prompts: gallery, editor, timeline, diff, variable panel | `components/asset-studio/*.tsx` (15 componentes) |

### ❌ Falta (Objetivo de Fase 4)

| Componente | Sprint |
|---|---|
| SQL RPC: `get_experiment_stats()` (aggregation) | 4.1 |
| SQL RPC: `get_experiment_timeseries()` (time-series) | 4.1 |
| Tipos: `TimeSeriesPoint`, `ExperimentWithStats`, `ChartColorConfig` | 4.1 |
| API refactor: `experiments/[id]/route.ts` incluir stats | 4.1 |
| API nuevo: `experiments/[id]/ts/route.ts` (timeseries) | 4.1 |
| Hook refactor: `useExperimentStats` → `ExperimentWithStats` | 4.1 |
| Hook nuevo: `useExperimentTimeSeries` | 4.1 |
| Utilidades: `lib/chart-utils.ts` | 4.1 |
| Shadcn Chart wrapper: `components/ui/chart.tsx` | 4.2 |
| `winner-badge.tsx` | 4.2 |
| `traffic-split-slider.tsx` | 4.2 |
| `experiment-stats-card.tsx` | 4.2 |
| `convergence-chart.tsx` (Recharts LineChart) | 4.2 |
| `outcome-distribution-chart.tsx` (Recharts BarChart) | 4.2 |
| `experiment-actions-bar.tsx` | 4.2 |
| `experiment-setup-dialog.tsx` (wizard 4 pasos) | 4.3 |
| `experiment-list.tsx` | 4.3 |
| `experiment-dashboard.tsx` (composición) | 4.3 |
| Page: `experiments/page.tsx` | 4.3 |
| Page: `experiments/[experimentId]/page.tsx` | 4.3 |
| Wiring: editor-toolbar → experiments | 4.3 |
| Skeletons, empty states, error boundaries | 4.4 |

---

## 1. Sprint 4.1 — Data Layer (~10h)

### Objetivo: Stats reales en el API

| # | Tarea | Tipo | Deps | Est. | Archivo de Salida |
|---|---|---|---|---|---|
| 4.1.1 | Migración SQL: funciones RPC `get_experiment_stats` y `get_experiment_timeseries` + índices de soporte | DB | — | 3h | `supabase/migrations/20260420100000_experiment_stats_rpc.sql` |
| 4.1.2 | Extender `types/experiment.ts` con `TimeSeriesPoint`, `ExperimentWithStats`, `ChartColorConfig` | Types | — | 30min | `crm-agentico-panel/types/experiment.ts` |
| 4.1.3 | Refactor `GET experiments/[experimentId]/route.ts` — agregar `stats: VariantStats[]` via `supabase.rpc('get_experiment_stats')` | API | 4.1.1 | 2h | `app/api/.../[experimentId]/route.ts` |
| 4.1.4 | Crear `GET experiments/[experimentId]/ts/route.ts` — devuelve `TimeSeriesPoint[]` via `supabase.rpc('get_experiment_timeseries')` con param `?bucket=day\|hour\|week` | API | 4.1.1 | 1.5h | `app/api/.../ts/route.ts` |
| 4.1.5 | Refactor `use-experiment-stats.ts` — return type `ExperimentWithStats`, conditional `refetchInterval: 30s` solo si `status === 'running'` | Hook | 4.1.3 | 1h | `hooks/queries/use-experiment-stats.ts` |
| 4.1.6 | Crear `use-experiment-timeseries.ts` — nuevo hook con `refetchInterval: 60s` | Hook | 4.1.4 | 1h | `hooks/queries/use-experiment-timeseries.ts` |
| 4.1.7 | Agregar `experiments.timeSeries` en `lib/query-keys.ts` | Lib | — | 10min | `lib/query-keys.ts` |
| 4.1.8 | Crear `lib/chart-utils.ts` — `VARIANT_COLORS`, `buildChartConfig()`, `pivotTimeSeries()` | Lib | 4.1.2 | 1h | `lib/chart-utils.ts` |

### Criterio de Aceptación 4.1
- `GET /api/prompts/:tid/experiments/:eid` devuelve `{ experiment, variants, stats: VariantStats[] }`
- `GET /api/prompts/:tid/experiments/:eid/ts?bucket=day` devuelve `TimeSeriesPoint[]`
- Con seed data de 500 impressions, stats muestran response_rate > 0

---

## 2. Sprint 4.2 — Charts + Componentes Base (~14.5h)

### Objetivo: Componentes visuales renderizando datos reales

| # | Tarea | Tipo | Deps | Est. | Archivo de Salida |
|---|---|---|---|---|---|
| 4.2.1 | Instalar Shadcn Chart: `npx shadcn@latest add chart` | Setup | — | 10min | `components/ui/chart.tsx` |
| 4.2.2 | Instalar Shadcn faltantes: `npx shadcn@latest add slider select switch form label` | Setup | — | 10min | `components/ui/` |
| 4.2.3 | `winner-badge.tsx` — badge dinámico: winner 🏆/loser/running(pulse)/paused/cancelled/leading | UI | — | 45min | `components/asset-studio/winner-badge.tsx` |
| 4.2.4 | `traffic-split-slider.tsx` — Shadcn Slider, min 10% por variante, increment 5%, sum=100 enforced. "Equal Split" button. Visual: barra segmentada horizontal con colores de `VARIANT_COLORS`. | UI | 4.2.2 | 3h | `components/asset-studio/traffic-split-slider.tsx` |
| 4.2.5 | `experiment-stats-card.tsx` — Card con 6 KPIs (impressions, response rate, positive rate, meetings, sentiment, avg response time). Props: `stats: VariantStats`, `variant: ABVariant`, `isWinner`, `isLeading`. Highlight border si isLeading. | UI | 4.2.3 | 2.5h | `components/asset-studio/experiment-stats-card.tsx` |
| 4.2.6 | `convergence-chart.tsx` — Shadcn `ChartContainer` + Recharts `LineChart`. Datos: `useExperimentTimeSeries`. Transform: `pivotTimeSeries()`. Una `<Line>` por variante con `VARIANT_COLORS`. Selector de bucket (hour/day/week). Tooltip: fecha + rate + N. | UI | 4.2.1, 4.1.6, 4.1.8 | 3.5h | `components/asset-studio/convergence-chart.tsx` |
| 4.2.7 | `outcome-distribution-chart.tsx` — Shadcn `ChartContainer` + Recharts stacked `BarChart`. X: variante. Y: conteo por outcome. Stack colors por outcome tipo. | UI | 4.2.1, 4.1.8 | 2.5h | `components/asset-studio/outcome-distribution-chart.tsx` |
| 4.2.8 | `experiment-actions-bar.tsx` — Botones contextuales por `experiment.status`: draft→[Start], running→[Pause][Declare Winner][Cancel], paused→[Resume][Declare Winner][Cancel], completed→[Promote Winner]. Warning amber si impressions < minImpressions en "Declare Winner". Usa mutations existentes. | UI | 4.2.3 | 2h | `components/asset-studio/experiment-actions-bar.tsx` |

### Criterio de Aceptación 4.2
- `convergence-chart` renderiza líneas con datos reales de seed
- `experiment-stats-card` muestra KPIs con números reales
- `traffic-split-slider` siempre suma 100%

---

## 3. Sprint 4.3 — Dashboard y Wizard (~14h)

### Objetivo: Flujo completo end-to-end (crear → ver → actuar)

| # | Tarea | Tipo | Deps | Est. | Archivo de Salida |
|---|---|---|---|---|---|
| 4.3.1 | `experiment-setup-dialog.tsx` — Dialog con 4 steps: (1) Name + min_impressions + confidence_level, (2) Select 2-4 prompt versions (checkboxes, filtrar archived), (3) TrafficSplitSlider, (4) Review summary → Create. Zod validation per step. Submit: `useCreateExperiment`. Navigate to dashboard on success. | UI | 4.2.4 | 5h | `components/asset-studio/experiment-setup-dialog.tsx` |
| 4.3.2 | `experiment-list.tsx` — Table: name, status(WinnerBadge), #variants, total impressions, created_at, row click→navigate. Header: [+ New A/B Test]→ExperimentSetupDialog. Empty: EmptyState "No experiments yet". Uses `useExperiments(templateId)`. | UI | 4.2.3 | 2.5h | `components/asset-studio/experiment-list.tsx` |
| 4.3.3 | `experiment-dashboard.tsx` — Composición: Header(name+StatusBadge+dates) → Grid(StatsCards) → ConvergenceChart → OutcomeDistributionChart → ActionsBar. Uses `useExperimentStats(templateId, experimentId)`. Loading: skeleton layout. Empty: "No impressions yet" message. Live badge pulsante si running. | UI | 4.2.5–4.2.8, 4.1.5 | 4h | `components/asset-studio/experiment-dashboard.tsx` |
| 4.3.4 | Page `app/(asset-studio)/prompts/[templateId]/experiments/page.tsx` | Page | 4.3.1, 4.3.2 | 1h | `app/(asset-studio)/.../experiments/page.tsx` |
| 4.3.5 | Page `app/(asset-studio)/prompts/[templateId]/experiments/[experimentId]/page.tsx` | Page | 4.3.3 | 45min | `app/(asset-studio)/.../ [experimentId]/page.tsx` |
| 4.3.6 | Wire `editor-toolbar.tsx` — botón 🧪 navega a `/prompts/[templateId]/experiments` | UI | 4.3.4 | 45min | `components/asset-studio/editor-toolbar.tsx` (editar) |

### Criterio de Aceptación 4.3
- Desde el editor de prompts, click en 🧪 lleva a experiment list
- Se puede crear un experiment con el wizard (name, versions, traffic split)
- El dashboard muestra stats cards + charts con datos del seed
- Actions bar permite start/pause/end/cancel experiment

---

## 4. Sprint 4.4 — Polish y Edge Cases (~7h)

| # | Tarea | Tipo | Deps | Est. | Archivo de Salida |
|---|---|---|---|---|---|
| 4.4.1 | Skeleton loaders: dashboard (3 cards shimmer + chart skeleton rectangle), experiment list (table rows shimmer) | UI | All | 2h | Inline en componentes |
| 4.4.2 | Empty states: experiment list ("No experiments…"), dashboard con 0 impressions ("Waiting for data…"), timeseries vacía (no renderizar chart, solo mensaje) | UI | All | 1.5h | Inline en componentes |
| 4.4.3 | `loading.tsx` para `experiments/` y `experiments/[experimentId]/` | Page | — | 30min | 2 × `loading.tsx` |
| 4.4.4 | `error.tsx` para ambas rutas | Page | — | 30min | 2 × `error.tsx` |
| 4.4.5 | Toast notifications (Sonner): create experiment ✅, start ✅, pause ⏸, end 🏁, cancel ✕, declare winner 🏆 | UX | — | 1h | Wiring en mutations callbacks |
| 4.4.6 | Responsive: cards stack en `< md`, chart `w-full`, slider stack vertical en mobile | UI | 4.3.3 | 1h | Tailwind responsive classes |
| 4.4.7 | Live badge: pulsating dot "● Live" en dashboard header cuando `experiment.status === 'running'` + refetch indicators | UI | 4.1.5 | 30min | `experiment-dashboard.tsx` |

### Criterio de Aceptación 4.4
- Dashboard con 0 impressions muestra mensaje claro (no chart roto)
- Loading states aparecen durante fetch
- Toasts confirman cada acción
- Mobile layout no se rompe

---

## 5. Resumen Total

| Sprint | Descripción | Horas | Días Dev |
|---|---|---|---|
| 4.1 | Data Layer | ~10h | 1.5 |
| 4.2 | Charts + Base Components | ~14.5h | 2 |
| 4.3 | Dashboard + Wizard | ~14h | 2 |
| 4.4 | Polish + Edge Cases | ~7h | 1 |
| **Total** | | **~45.5h** | **~6.5 días (~1.5 semanas)** |

---

## 6. Dependencias a Instalar

```bash
cd crm-agentico-panel/

# Shadcn components (verificar cuáles faltan antes de instalar)
npx shadcn@latest add chart slider select switch form label

# No se necesitan npm installs adicionales — recharts@3.8.1 ya está en package.json
```

---

## 7. Reglas para el Ejecutor

### ✅ DO
1. **`supabase.rpc()`** para toda aggregation — no contar en JavaScript.
2. **Shadcn `ChartContainer`** para todos los charts — no Recharts crudo.
3. **Dynamic import** para charts: `const X = dynamic(() => import('./X'), { ssr: false })`.
4. **`useExperimentStats(templateId, experimentId)`** — dos parámetros obligatorios.
5. **`VARIANT_COLORS` de `chart-utils.ts`** — colores consistentes.
6. **Seed data** — ejecutar `seed-experiment-data.sql` para testing visual.
7. **`pivotTimeSeries()`** — no reinventar el pivoting en cada chart.

### ❌ DON'T
1. **NO instalar Nivo, Tremor, Chart.js** — Recharts + Shadcn Chart es la decisión arquitectural.
2. **NO agregar datos de server a Zustand** — TanStack Query es el owner (ADR-113).
3. **NO hacer fetch en useEffect** — solo TanStack Query hooks.
4. **NO hardcodear colores** — `VARIANT_COLORS` + CSS variables de Shadcn.
5. **NO crear tablas nuevas** — el schema de Fase 1 es completo. Solo RPCs e índices.
6. **NO renderizar charts con 0 data points** — mostrar empty state.
7. **NO skip `ConfirmDialog`** en acciones destructivas (cancel, declare winner).

---

## 8. Diagrama de Dependencias entre Tareas

```
4.1.1 (SQL RPC) ──────────────┬───→ 4.1.3 (API refactor) ──→ 4.1.5 (Hook refactor)
                               │
                               └───→ 4.1.4 (API timeseries) ──→ 4.1.6 (Hook timeseries)

4.1.2 (Types) ──→ 4.1.8 (chart-utils)

4.2.1 (Shadcn Chart install) ─┬───→ 4.2.6 (convergence-chart)
                               └───→ 4.2.7 (outcome-chart)

4.2.2 (Shadcn slider/select) ─────→ 4.2.4 (traffic-split-slider) ──→ 4.3.1 (setup dialog)

4.2.3 (winner-badge) ─────────┬───→ 4.2.5 (stats-card) ──→ 4.3.3 (dashboard)
                               ├───→ 4.2.8 (actions-bar) ──→ 4.3.3
                               └───→ 4.3.2 (experiment-list)

4.2.5 + 4.2.6 + 4.2.7 + 4.2.8 ──→ 4.3.3 (experiment-dashboard)

4.3.1 + 4.3.2 ──→ 4.3.4 (experiments page)
4.3.3 ──→ 4.3.5 (dashboard page)
4.3.4 ──→ 4.3.6 (editor-toolbar wiring)

All ──→ 4.4.* (polish)
```

---

*Builder (Arquitecto Staff) — Escuadrón Teseo | AssetStudio_Fase4_WBS v1.0 | 2026-04-20*
*Conforme a TOPOLOGY.json → vault: `docs/`*
