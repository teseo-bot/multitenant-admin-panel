# ADR-138: Dashboard Core Facade Pattern

## 1. Contexto y Problema
En el Bloque 8 logramos implementar las bases de telemetría (Andon Alerts - ADR-136) y la orquestación de facturación IA (Edge FinOps - ADR-137). Sin embargo, la página raíz del panel (`/(dashboard)/page.tsx`) se encuentra desactualizada, careciendo de una visión central (Mission Control). Para un entorno B2B, el usuario necesita visualizar el valor del sistema apenas inicia sesión: Volumen de Leads, Tasas de Resolución (IA) y Consumo (Gasto FinOps), sin tener que navegar por múltiples pantallas.

## 2. Decisión Arquitectónica
Se implementará el patrón **API Facade** para el Dashboard Principal. 

En lugar de que el frontend realice múltiples llamadas a distintos endpoints (leads, analítica, finops), construiremos un único Route Handler en Next.js (`GET /api/dashboard/summary/route.ts`). Este BFF (Backend-For-Frontend) resolverá concurrentemente los datos de las distintas fuentes (RPCs de Postgres y tablas agregadas), consolidándolos en una estructura de KPI unificada.

### 2.1 Restricciones Inquebrantables
1. **Aislamiento Multitenant (ADR-135):** Todas las consultas SQL u orquestación RPC dentro del Facade DEBEN inyectar o filtrar por el `tenant_id` validado a través de Supabase Auth SSR.
2. **Caché Defensiva (TanStack Query):** Los datos financieros y métricas globales se consultarán usando un `staleTime` de 5 minutos (300,000 ms) en el frontend. El Dashboard principal no usará reconexión SSE estricta para FinOps con el fin de proteger los recursos de BD ante presiones excesivas del Pool.

## 3. Topología de Componentes

### 3.1 Capa API (Backend-For-Frontend)
- **Endpoint:** `app/api/dashboard/summary/route.ts`
- **Orquestación Concurrente (`Promise.all`):**
  1. `rpc_get_conversion_metrics` (Lead Stats y Tasa de Conversión).
  2. Sumatoria total de `total_cost` en `finops_token_ledger` filtrado por el Tenant y el mes en curso.
  3. *(Opcional)* Conteo de Threads activos con estatus "Hand-off" (Intervención humana requerida).

**Estructura del Payload (Contrato API):**
```json
{
  "leads": {
    "total": 145,
    "conversionRate": 42.5
  },
  "finops": {
    "totalCostUsd": 12.45,
    "currency": "USD"
  },
  "handoffs": {
    "pending": 3
  }
}
```

### 3.2 Capa React Hooks
- **Hook:** `hooks/queries/use-dashboard-summary.ts`
- Utiliza `useQuery` de `@tanstack/react-query` conectado al endpoint del Facade con `staleTime: 300000`.

### 3.3 Capa UI (Presentación)
- **Ruta:** `app/(dashboard)/page.tsx`
- **Componentes:**
  - 3 `Card` (KpiCards) principales para mostrar de un vistazo: Leads Activos, Tasa de Conversión e IA Costo.
  - Reutilización inteligente de las dependencias preexistentes en `components/ui/card` e íconos de `lucide-react`.

## 4. Work Breakdown Structure (WBS) para Ejecutor

| ID | Tarea | Componente Afectado | Criterio de Aceptación |
|----|-------|---------------------|-------------------------|
| 1.1 | Endpoint Facade API | `app/api/dashboard/summary/route.ts` | Endpoint 200 OK con payload unificado validando auth de Supabase. Retorna costos calculados de `finops_token_ledger`. |
| 2.1 | Hook TanStack Query | `hooks/queries/use-dashboard-summary.ts` | Hook estructurado, maneja loading, error y caché 5 min. |
| 3.1 | UI Dashboard Root | `app/(dashboard)/page.tsx` | Pantalla renderizada con las 3 KpiCards y diseño cohesivo (Skeleton loaders incluidos). |

## 5. Consecuencias
- **Positivas:** Reducción drástica del *Network Waterfall* en el inicio de sesión. La experiencia de usuario percibe alta velocidad y control absoluto del sistema (FinOps + CRM) desde el segundo cero.
- **Negativas:** La agregación de costos (`SUM(total_cost)`) directo sobre `finops_token_ledger` puede volverse ineficiente cuando existan millones de transacciones. A futuro se requerirá un Cron/Job que materialice el gasto mensualmente (Rollup Tables).
