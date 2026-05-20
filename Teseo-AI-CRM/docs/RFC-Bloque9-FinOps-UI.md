# RFC-Bloque9: FinOps UI (Mission Control)
**Dominio:** `teseo-ai-crm`
**Autor:** Builder (Arquitecto Staff)
**Fecha:** 22 Abril 2026

## 1. Contexto y Objetivo
Implementar la interfaz de visualización financiera (FinOps) en el dashboard del CRM. La vista consume `tenant_financial_summary_view` (implementada en ADR-109) operando exclusivamente bajo HTTP/REST mediante `@supabase/supabase-js` (según las restricciones del ADR-136 para Cloud Run).

## 2. Arquitectura y Trade-offs
- **Patrón de Consumo (Data Fetching):** Se descarta el uso de WebSockets o `pg_notify`. Se utilizará **React Query (Short-Polling)**.
  - *Trade-off:* Mayor cantidad de requests HTTP vs. Estabilidad garantizada en contenedores serverless (Cloud Run).
- **Seguridad y Aislamiento (RLS):**
  - El frontend **NO** debe inyectar manualmente el `tenant_id` en las consultas `.select()`.
  - La seguridad recae en el JWT proporcionado por Supabase Auth. El motor de Postgres aplicará el Row Level Security (RLS) automáticamente, mitigando riesgos de Insecure Direct Object Reference (IDOR).

## 3. Work Breakdown Structure (WBS) para Ejecutor

### Fase 1: Capa de Acceso a Datos (Service)
- **Objetivo:** Crear el puente de comunicación con Supabase.
- **Implementación:** Función asíncrona `fetchFinancialSummary()` que realice el `.select('*')` a la vista `tenant_financial_summary_view`.
- **Restricciones:** Tipado estricto en TypeScript. Manejo explícito de excepciones (retorno de errores tipados).

### Fase 2: Capa de Estado (Hooks / React Query)
- **Objetivo:** Encapsular la lógica de short-polling y caché.
- **Implementación:** Hook personalizado `useFinOpsSummary()`.
- **Restricciones:** Configurar `refetchInterval` a un valor conservador (ej. 30s - 60s) para simular tiempo real sin saturar la cuota de lectura de la base de datos.

### Fase 3: Capa de Presentación (UI)
- **Objetivo:** Renderizar métricas en Mission Control.
- **Componentes:**
  - `FinOpsDashboard.tsx`: Contenedor principal (Smart Component).
  - `MetricCard.tsx`: Componente presentacional puro (Dumb Component) para Tokens Totales, Costo Estimado ($), y Peticiones.
- **Restricciones:** Delegar el manejo de estados (`isLoading`, `isError`) a los retornos de React Query. Proveer "Skeleton loaders" para evitar saltos de layout (CLS).

## 4. Criterios de Aceptación (Para Tester/Reviewer)
1. Cero errores rojos o warnings en consola durante el montaje (`localhost`).
2. Comportamiento idempotente ante la desconexión simulada (React Query debe reintentar silenciosamente).
3. Auditoría de RLS: Un usuario solo debe visualizar el output correspondiente a su propio Tenant.