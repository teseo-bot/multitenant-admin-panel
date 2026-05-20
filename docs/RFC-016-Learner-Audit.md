# Auditoría RAG: RFC-016 Command Center UI

## 1. Contexto de la Auditoría
- **Documento Analizado:** `/Users/teseohome/projects/Teseo-AI-CRM/docs/RFC-Command-Center-UI.md`
- **Rutas Verificadas:** `crm-agentico-panel/app` y `crm-agentico-panel/components` (verificados componentes base como `app-sidebar.tsx` y `layout.tsx`).
- **Base de Conocimiento:** `TeseoKDB` (`/Users/teseohome/Documents/teseokdb/compiled/`)

## 2. Hallazgos del Cruzamiento con TeseoKDB

Se evaluaron los pilares tecnológicos propuestos (Zustand, SSE, Server Components, Shadcn) contra la memoria corporativa (TeseoKDB):

### 🔴 Violación Arquitectónica Crítica (Manejo de Estado)
El **RFC-016** propone manejar los `threads` y el estado asíncrono (como las respuestas de SSE y optimismo de Kanban) usando **Zustand** (`inbox-store.ts` y `kanban-store.ts`).
- **Referencia TeseoKDB:** Según el registro `2026-04-07-tanstack-query-migration.md`, la arquitectura manda usar **TanStack Query** para **Server State** (caché, mutaciones) y limitar **Zustand** a **Client-only State** (selecciones UI, UI draft states).
- **El registro dictamina:** *"WebSocket [and SSE] events bridge to TanStack Query via `queryClient.setQueryData` / `invalidateQueries`"*.
- **Desviación:** El RFC ignora esta regla usando Zustand para retener caché de servidor (`initialThreads`) y mutar eventos de la red (`upsertThread` en la Sección 6 y 7).

### 🟡 Uso de Server Components
El patrón de usar un Server Component para cargar la data (`inbox-list.tsx`) y pasarla a un Client Component como prop es correcto en App Router, pero el RFC especifica hidratar esos datos dentro del store de Zustand (`setThreads`), lo cual es un anti-patrón de hidratación según el nuevo esquema con TanStack Query (debería usar `<HydrationBoundary>`).

### 🟢 Componentes Shadcn/UI
El uso de `shadcn/ui` y los componentes solicitados para instalar son correctos y se alinean con la librería visual registrada en la base de código.

## 3. Conclusión y Veredicto

El diseño técnico no puede ser ejecutado en su estado actual, ya que el Ejecutor introduciría código heredado (Zustand como data-fetch cache) que el equipo técnico explícitamente decidió erradicar y migrar hacia TanStack Query. 

Se requiere que el **Builder (Planificador)** emita una corrección a las secciones 6 y 7 del RFC-016, reemplazando los stores por `useQuery`, `useMutation` y controlando el canal SSE a través de `queryClient`.

**FAIL**
