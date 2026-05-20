# PRD - Bloque 33: Pruebas E2E y Eventos en Tiempo Real (SSE)

## 1. Objetivo General
Validar la comunicación bidireccional entre el Orquestador Agentico (`crm-agentico-orquestador`) y el Command Center (`teseo-mission-control`) en Producción, implementando Server-Sent Events (SSE) para reflejar actualizaciones asíncronas en el `ProspectCanvas` sin requerir recarga manual del cliente (Zero-F5).

## 2. Arquitectura de Integración SSE

El pipeline técnico para la integración en tiempo real se divide en tres capas fundamentales:

### Capa 1: Emisión (Orquestador - Hono / LangGraph)
- **Endpoint SSE:** El orquestador debe exponer un endpoint (ej. `/api/events/prospects/:id`) que mantenga conexiones HTTP persistentes `text/event-stream`.
- **Event Bridge:** Cuando LangGraph o el motor de Obscura actualiza datos de un prospecto, el Orquestador emite un payload JSON estructurado hacia todos los clientes suscritos al hilo/prospecto.

### Capa 2: Recepción (Command Center - Next.js)
- **Cliente `EventSource`:** El componente de UI `ProspectCanvas` instancia un cliente `EventSource` apuntando a la URL del Orquestador en Cloud Run.
- **Manejo de Desconexión:** Implementación de reconexión exponencial pasiva en caso de caída del túnel TCP.

### Capa 3: Persistencia Reactiva (Frontend)
- Al recibir un evento SSE, el frontend fusiona el estado en el caché (React Query / Zustand / Context) para desencadenar el re-render de componentes granulares (ej. un badge de "Enriquecido", o la inyección de notas de RAG).

## 3. Resolución Técnica de Obscura (Opcional - Fase 2)
Una vez estabilizado el túnel SSE:
- **Transición:** Reemplazar llamadas nativas de Puppeteer por llamadas a Obscura (Rust Headless Browser).
- **RAG Updates:** Sincronizar logs de navegación de Obscura hacia el flujo SSE para mostrar en el Command Center la bitácora de acciones del agente ("Navegando a linkedin.com/...", "Extrayendo matriz de decisión").

## 4. Work Breakdown Structure (WBS) - Bottom-Up

1. **Definición de Contratos (API):** Establecer formato JSON del payload SSE.
2. **Implementación de Endpoint SSE (Backend):** Crear el router `/events` en el Orquestador.
3. **Cliente SSE (Frontend):** Conectar `ProspectCanvas` a la ruta en Cloud Run y probar mutación en estado local.
4. **Validación E2E en Producción:** Disparar un webhook real desde el Kanban y verificar flujo de eventos en la UI remota.
