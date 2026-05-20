# Reporte de Impacto: Inbox Wiring & Auth Context

**Fecha:** 2026-04-20
**Agente:** Learner (Investigador de Contexto / RAG Engineer)
**Ref:** `RFC-Inbox-Wiring.md`

## 1. Análisis del RFC y Estado Actual de UI

El `RFC-Inbox-Wiring.md` establece la arquitectura para la inyección de contexto de autenticación (Auth) y el ensamblado visual de la bandeja de entrada usando un Split-Pane.

### Inspección de Componentes Actuales:
- **`app/(command-center)/inbox/page.tsx`**: Actualmente es un placeholder. Muestra un listado usando `DUMMY_CONVERSATIONS` en un layout vertical simple (`flex-col`). No hay inyección de estado ni split-pane.
- **`components/inbox/inbox-list.tsx`**: Ya implementado. Consume `useThreadList` (TanStack Query) y `useInboxUIStore` (Zustand).
- **`components/inbox/inbox-thread-view.tsx`**: Ya implementado. Consume `useMessages` y mutaciones. Tiene un bloque pendiente explícito: `// TODO: inject from auth context` para el `operatorId` en `HandoffBar`.

## 2. Directrices de la Base de Conocimiento (TeseoKDB)

Al cruzar el RFC propuesto con la documentación arquitectónica base (`docs/`), se validan y corrigen los siguientes puntos:

1. **Uso de Zustand vs TanStack Query (`ADR-111`)**:
   - **Regla Estricta:** Zustand se restringe *exclusivamente* a **Client-only UI State**. El servidor no debe cachearse en Zustand.
   - **Veredicto para este RFC:** La propuesta de crear un `useAuthStore` en Zustand para el `operatorId` (y datos de sesión iniciales hidratados desde el servidor) es **correcta y cumple el ADR-111**, ya que es contexto UI/Client-side, mientras que la data asíncrona se deja en TanStack Query.
2. **Directrices de "Split-Pane"**:
   - **Regla Estricta (`RFC-Command-Center-UI.md`):** Aunque el RFC menciona "CSS Grid o Flexbox", el proyecto ya tiene instalado y estandarizado el uso del componente `Resizable` de Shadcn/UI (`react-resizable-panels`).
   - **Veredicto para este RFC:** El componente `<InboxWorkspace>` deberá construirse estrictamente usando `ResizablePanelGroup`, `ResizablePanel` y `ResizableHandle` (`@/components/ui/resizable`).

## 3. Plan de Acción y Archivos a Modificar (Para el Ejecutor)

Para materializar el `RFC-Inbox-Wiring.md`, el Ejecutor (Night) deberá alterar o crear los siguientes archivos:

### Archivos Nuevos a Crear:
1. `crm-agentico-panel/stores/auth-store.ts`: Para crear el `useAuthStore` de Zustand (`operatorId`).
2. `crm-agentico-panel/components/inbox/inbox-client-provider.tsx`: Para la hidratación de datos del servidor hacia el cliente (Auth).
3. `crm-agentico-panel/components/inbox/inbox-workspace.tsx`: Para ensamblar el Split-Pane combinando `InboxList` e `InboxThreadView` usando Shadcn `Resizable`.

### Archivos Existentes a Modificar:
1. `crm-agentico-panel/app/(command-center)/inbox/page.tsx`: 
   - Eliminar los mocks (`DUMMY_CONVERSATIONS`).
   - Implementar el fetch inicial o validación de sesión (Server Component).
   - Envolver el layout con `<InboxClientProvider>` y renderizar `<InboxWorkspace>`.
2. `crm-agentico-panel/components/inbox/inbox-thread-view.tsx`:
   - Enlazar el `operatorId` desde `useAuthStore` al HandoffBar para reemplazar el placeholder `current-user`.

## 4. Conclusión
El terreno está preparado. La UI base existe pero no está ensamblada, y las directrices de Zustand y Split-Pane están claras. El Ejecutor puede proceder con el cableado.
