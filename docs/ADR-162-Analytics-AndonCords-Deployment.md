# ADR-162: Arquitectura de Analytics y Andon Cords (HITL)

**Fecha:** 24 de Abril de 2026
**Estado:** Aceptado
**Autores:** Builder & Reviewer

## 1. Contexto
En el Bloque 22 se requería implementar analíticas para el Dashboard y un sistema de streaming para observar las interacciones del agente autónomo en tiempo real (Andon Cords), sin saturar el Event Loop de PostgreSQL ni generar condiciones de carrera en el cliente.

## 2. Decisión
1. **Analíticas en BD (RPCs):** Se decidió abstraer las consultas pesadas mediante Procedimientos Almacenados (RPCs) en Supabase (`rpc_get_leads_by_status`, `rpc_get_conversion_metrics`), indexando las columnas de estado y fechas, e inyectando `app.current_tenant` nativamente para asegurar RLS.
2. **Doble Barrera de Estado (Frontend):** Para el streaming del agente (`agent_chunk`), se implementó un Store Efímero en Zustand (`useAgentStreamStore`) desacoplado de TanStack Query. Se incluyó un *Pruning Hook* que auto-elimina los streams efímeros en cuanto TanStack recibe el mensaje consolidado con el mismo ID desde el backend.

## 3. Consecuencias
- **Positivas:** Escalabilidad transaccional asegurada; latencia cero en la visualización humana de lo que el agente escribe.
- **Negativas / Deuda Técnica:** Las métricas devueltas actualmente son crudas. Queda como deuda técnica la integración de una biblioteca de gráficos avanzados (Recharts/Tremor) en el Dashboard.
