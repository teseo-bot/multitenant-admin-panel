# ADR-111: Separación Estricta de TanStack Query (Server) y Zustand (Client) en Command Center

## Estado
Aceptado

## Fecha
2026-04-20

## Contexto
Durante el diseño del `crm-agentico-panel` (Command Center), el equipo planificador (RFC-016 v1.0) propuso utilizar Zustand para gestionar el caché de las conversaciones (Server State), incluyendo la retención de hilos asíncronos y eventos SSE. Sin embargo, esto violaba una decisión arquitectónica previa (`2026-04-07-tanstack-query-migration.md`) sobre la estandarización de la gestión del Server State.

## Decisión
1. Se rechaza estrictamente el uso de Zustand como caché de datos provenientes del servidor.
2. Se implementa **TanStack Query v5** como única fuente de verdad para el **Server State**.
3. Se restringe **Zustand** de manera exclusiva para manejar **Client-only UI State** (ej. estado de la interfaz, hilos seleccionados, filtros visuales).
4. La inyección de eventos en tiempo real (Server-Sent Events - SSE) se puentea directamente hacia TanStack Query usando `queryClient.setQueryData`, evitando renderizados innecesarios y garantizando la frescura del caché.
5. Las mutaciones críticas (ej. *Handoff* de leads) deben implementar Optimistic Updates con su respectiva política de Rollback en caso de error de red usando `onMutate` y `onError`.

## Consecuencias
- **Positivas:** Clara separación de responsabilidades (UI vs Data Fetching). Mutaciones más resilientes. El manejo de SSE integrado con el caché previene condiciones de carrera o desincronización de datos.
- **Negativas:** Curva de aprendizaje y boilerplate inicial (query keys, setups de `useMutation` con rollbacks), lo que requiere rigor en el Sprint de Fundamentos.
