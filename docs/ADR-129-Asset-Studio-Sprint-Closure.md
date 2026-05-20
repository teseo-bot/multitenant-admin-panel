# ADR-129: Cierre de Sprint - Asset Studio Phase 1 & E2E Preparation

## 1. Contexto
El sprint del 21 de Abril de 2026 concluyó con la estabilización de los módulos operativos del Tenant OS (Command Center, Inbox Dual, HITL). Se procedió a integrar el bloque de configuración del usuario: **Asset Studio**.

## 2. Decisiones Arquitectónicas y Post-Mortem
1. **Prevención de Deuda Técnica (Prompts):** Se detectó que el equipo de Fases 1-4 ya había creado interfaces avanzadas (`PromptEditorLayout`, `PromptGallery`). En lugar de reescribir un CRUD básico, se integró el enrutador de Next.js directamente con estos componentes de alta fidelidad, asegurando el soporte futuro para A/B Testing y Diffing.
2. **Infraestructura RAG (Documents):** Se consolidó la ingesta documental combinando Supabase Storage (`tenant_documents` Bucket) y PostgreSQL (`tenant_memories` con `pgvector`).
3. **Gestión de Variables Dinámicas:** Se implementó un gestor seguro con validación estricta (Zod + react-hook-form) y codificación de color por tipo de dato, listo para inyectarse en LangGraph.
4. **Despliegue y E2E:** Se empacó la aplicación en un contenedor Multi-Stage (Standalone) para Google Cloud Run. La decisión inquebrantable (RFC-050) dicta que las pruebas de regresión automáticas (Playwright) deben correrse **exclusivamente contra el entorno desplegado** y no en local, para garantizar la fidelidad del entorno B2B.

## 3. Estado Final
El Tenant OS está 100% operativo a nivel código. El sistema se encuentra congelado y empaquetado en un backup local estático a la espera del despliegue en GCP para el Quality Assurance final.
