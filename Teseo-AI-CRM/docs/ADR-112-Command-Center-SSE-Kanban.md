# ADR 112: Command Center, SSE Nativo, Auth Store y Kanban D&D

**Fecha:** 20 de Abril de 2026
**Estado:** Aceptado

## Contexto y Decisiones Estratégicas

Durante el desarrollo del Command Center del Teseo AI CRM, se tomaron tres decisiones arquitectónicas clave respecto al tiempo real, estado de autenticación y la interfaz del panel:

### 1. Postgres Nativo (LISTEN/NOTIFY) vía SSE en lugar de Supabase Realtime
**Decisión:** Abandono de Supabase Realtime en los Route Handlers Serverless por un Singleton de Postgres Nativo utilizando `LISTEN/NOTIFY`.
**Justificación:** Esta arquitectura previene la caída por timeouts en contenedores de GCP Cloud Run y mitiga los severos problemas de memory leaks asociados a mantener sockets abiertos en instancias efímeras.

### 2. Estrategia de Hidratación Auth Híbrida
**Decisión:** Utilizar hidratación SSR hacia un Client Store de Zustand.
**Justificación:** Previene el anti-patrón de prop-drilling en implementaciones complejas con TanStack Query, garantizando que el árbol de componentes tenga acceso síncrono al estado del usuario desde el inicio.

### 3. D&D Kanban In-House
**Decisión:** Elección de `@dnd-kit` complementado con Mutaciones Optimistas.
**Justificación:** Provee las primitivas de accesibilidad, modularidad y performance requeridas para el Kanban interno, asegurando una UI ágil e inmediata para el usuario final.
