# RFC-038: Capa de Agregación de Datos para Reportes (Analytics Dashboard)

## 1. Contexto y Objetivos
Con el bloque transaccional del Command Center estabilizado (Kanban, Inbox Dual, Agentic Event Bridge), es necesario habilitar la visión ejecutiva (Dashboard). 
El objetivo es proveer las métricas fundamentales (Leads por Status, SLA de agentes, y Conversion Rate) sin degradar el rendimiento del pool transaccional de lectura/escritura (Realtime SSE).

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. Aislamiento Transaccional vs Analítico
Para evitar la sobrecarga del esquema OLTP (Online Transaction Processing) principal, las métricas serán calculadas del lado de la base de datos (PostgreSQL en Supabase) mediante dos mecanismos:
- **Vistas Materializadas (Materialized Views) / RPCs:** Procesamiento en background de las agregaciones pesadas.
- **Indexación Selectiva:** Creación de índices compuestos sobre las tablas `leads` e `inbox_messages` enfocados estrictamente en las cláusulas `WHERE` del dashboard (fechas y estados).

### 2.2. Diseño de Métricas (Endpoints RPC propuestos)

#### A. Distribución de Leads por Estado (`rpc_get_leads_by_status`)
- **Propósito:** Alimentar las gráficas de embudo (Funnel) o Pay (Pie Chart).
- **Mecanismo:** Agrupación simple en tabla `leads` por la columna `status`.

#### B. Análisis de Conversión y SLA (`rpc_get_conversion_metrics`)
- **Propósito:** Evaluar la efectividad del cierre y el tiempo en la bandeja.
- **Mecanismo:** Cálculo diferencial (timestamps) entre la creación del lead y el cambio de estado a `resolved` o `archived`.

## 3. Plan de Implementación (WBS)

### Fase 1: Migración DDL (Base de Datos)
1. **Creación de Funciones SQL:** Redactar los RPCs (`get_leads_by_status`, `get_conversion_metrics`) asegurando compatibilidad con Row Level Security (RLS) para contextos multi-tenant futuros, aunque actualmente operamos Single-Tenant.
2. **Índices de Performance:** Inyectar sentencias `CREATE INDEX` sobre las fechas de creación y estados de los Leads para optimizar los conteos masivos.
3. **Persistencia de Migración:** Generar el archivo `.sql` correspondiente en la carpeta `supabase/migrations`.

### Fase 2: Exposición en API Edge (Next.js)
1. Generar la ruta `/api/analytics` o integrar invocaciones RPC directamente a través de Route Handlers bajo autenticación SSR.

### Fase 3: Integración UI
*(Delegado al siguiente ticket de diseño Frontend)*

## 4. Riesgos y Mitigaciones
- **Sobrecarga de RPCs Frecuentes:** Mitigado por el uso inteligente de `TanStack Query` del lado del cliente, con `staleTime` agresivo (ej. 5 minutos) para evitar llamadas constantes a la BD por parte de múltiples dashboards abiertos.
- **Degradación del Event Loop de Postgres:** Los queries de agregación serán simples (count/group by) sobre datos indexados. No representan un riesgo inminente hasta superar las decenas de miles de registros.

---
**Aprobación Pendiente:** Learner auditará los esquemas de tablas actuales antes de la redacción SQL.
