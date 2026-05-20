# RFC-040: UI/UX Analytics Dashboard (Tenant OS)

## 1. Objetivo y Patrón de Diseño
Diseñar la pestaña analítica del Command Center utilizando las mejores prácticas de la industria para Paneles SaaS B2B, inspirados en Linear, Vercel y Stripe. El diseño priorizará el "Data-ink ratio", eliminando bordes innecesarios, minimizando colores estridentes y enfocándose en la jerarquía tipográfica y Skeleton Loaders.

## 2. Stack Tecnológico
- **Visualización:** `recharts` (ResponsiveContainer, BarChart, PieChart).
- **Consumo de Datos:** `@tanstack/react-query` (con caché `staleTime: 5 * 60 * 1000`).
- **Componentes Base:** `shadcn/ui` (Cards, Skeletons, Tooltips).
- **Estilos:** Tailwind CSS con clases semánticas CSS variables (ej. `bg-background`, `text-muted-foreground`).

## 3. Work Breakdown Structure (WBS)

### Fase 1: Hook de Obtención de Datos (`use-analytics.ts`)
Crear el hook en `hooks/queries/use-analytics.ts` que se encargue de fetchear el endpoint `/api/analytics` que creamos en el RFC-039.
- **Tipado estricto:** Definir interfaces para `StatusDistribution` y `ConversionMetrics`.
- **Manejo de estados:** Retornar `data`, `isLoading` e `isError`.

### Fase 2: Componentes de Skeleton Loading (`AnalyticsSkeleton.tsx`)
Siguiendo las mejores prácticas de retención de atención y CLS (Cumulative Layout Shift):
- Componente para reemplazar el Top-Row (Tarjetas de KPls) con pulso (`animate-pulse`).
- Componente para reemplazar el área de las gráficas manteniendo el `aspect-ratio` idéntico al renderizado final.

### Fase 3: Tarjetas de KPI (Top Row)
Crear una cuadrícula (Grid) superior con 3-4 tarjetas `shadcn/ui` mostrando:
- **Total de Leads** (Número grande).
- **Leads Ganados (Won)** (Destacado con acento de éxito sutil).
- **Tasa de Conversión (%)** (Indicador clave).

### Fase 4: Gráficos de Datos (`ChartsContainer.tsx`)
1. **Gráfico de Barras o Dona (Status Distribution):** 
   - Renderiza el conteo de leads por `status`.
   - Colores mapeados al diseño del Kanban (ej. New = Blue, Won = Green, Lost = Red) utilizando las variables CSS globales para soportar Dark Mode nativamente.
   - Herramientas: `PieChart` (con `InnerRadius` para estilo dona) y `Tooltip` personalizado.

### Fase 5: Integración en el Layout Principal (`DashboardPage.tsx` o tab correspondiente)
Acoplar el `<AnalyticsDashboard />` al sistema de navegación/tab que creamos en los Sprints del UI Shell.
- Inyectar el componente con `React.Suspense` o manejar los estados directamente a través del hook.

## 4. Riesgos y Mitigaciones
- **Problemas de Renderizado Recharts + SSR:** Recharts lanza advertencias si se renderiza en el servidor. 
- **Mitigación:** Asegurar que el componente padre del dashboard tenga la directiva `"use client"`, o cargar dinámicamente (`next/dynamic` con `ssr: false`) los gráficos más pesados si la hidratación falla.

---
**Aprobación:** Este documento marca el inicio de la inyección de código del Ejecutor para construir la interfaz.
