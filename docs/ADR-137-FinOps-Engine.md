# ADR-137: FinOps Engine & Dashboards (Bloque 8)

## 1. Contexto Estratégico

Tras estabilizar la deuda técnica del Bloque 3-5 (UAT cerrado) e implementar un sistema de Short-Polling tolerante a fallos para el Inbox, el siguiente paso táctico es habilitar el modelo de negocio Multi-Tenant y sus cobros (SaaS B2B).
La empresa necesita cuantificar el consumo de cada interacción (Tokens de Input / Output / Costos Fijos por Llamada de Voz).

## 2. Decisiones Arquitectónicas

1.  **Agregación de Costos por Tenant (Token vs Pricing):**
    *   No dependeremos de resúmenes externos al final de mes. La inyección y el consumo de Tokens se registrará en una tabla analítica especializada (`tenant_token_usage`) anclada a cada Lead / Message.
    *   El orquestador en backend (Hono / LangGraph) despachará métricas (Input/Output tokens y modelo usado) usando Webhooks internos o Supabase Functions para persistirlas.
    *   La agregación permitirá visualizar costos diarios, mensuales, y por Agente de IA.

2.  **Facade Pattern para Mission Control (Dashboard):**
    *   A diferencia del Command Center de operadores (centrado en leads), **Mission Control** requiere un vistazo consolidado de finanzas, volumen de operaciones, y métricas globales.
    *   Implementaremos un patrón Facade para unificar consultas pesadas (`SUM()`, `COUNT()`) en una o varias Vistas SQL (`CREATE VIEW`) en Supabase, minimizando el I/O en el cliente y dejando que la base de datos entregue estadísticas preconsolidadas.

## 3. Próximos Pasos (Bottom-Up)

1.  **Definir Esquema de Datos:** Diseñar e implementar las migraciones SQL para `tenant_token_usage` y las vistas analíticas (`tenant_financial_summary_view`).
2.  **Interfaz Backend (Eventos de Consumo):** Adaptar el código del orquestador (Hono/LangGraph) para que emita eventos de consumo de tokens después de cada LLM Call (Node de Generación de Respuesta).
3.  **UI - FinOps Dashboard:** Construir las gráficas e indicadores clave de rendimiento (KPIs) en el Command Center.