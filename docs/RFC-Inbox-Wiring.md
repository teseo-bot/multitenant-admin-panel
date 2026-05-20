# RFC: Inbox Frontend Wiring & Auth Context

**Estado:** Propuesta de Diseño Técnico (Draft)
**Autor:** Teseo (Builder / Arquitecto Staff)
**Proyecto:** Teseo-AI-CRM
**Fecha:** 2026-04-20

## 1. Objetivo
Diseñar la arquitectura del frontend para la bandeja de entrada (Inbox), asegurando una inyección de autenticación segura, un ensamblaje correcto de la UI (`InboxList` e `InboxThreadView`) en la vista principal, y la integración robusta del manejo de estado asíncrono y tiempo real usando TanStack Query v5 y Server-Sent Events (SSE).

## 2. Estrategia de Autenticación (Auth Context)
**Decisión:** Uso de **Server Components para inyección de estado inicial** hacia un Store global en el cliente (Zustand).

### Razonamiento:
Dado que la API ya utiliza SSR Auth, mantener la validación primaria en el servidor maximiza la seguridad y reduce el "layout shift". 
1. **Server Component (`page.tsx`):** Validará la sesión usando Supabase SSR (o la capa existente). Extraerá el `operatorId` (y datos básicos del usuario) de forma segura en el servidor.
2. **Hidratación en Cliente:** Este `operatorId` se pasará como `prop` a un Client Component contenedor (`<InboxClientProvider operatorId={operatorId} />`).
3. **Zustand Store:** El proveedor inicializará (hydrate) un store de Zustand para que cualquier componente anidado (como listas de queries o mutaciones) tenga acceso instantáneo y síncrono al `operatorId` sin necesidad de prop-drilling, optimizando los re-renders.

## 3. Ensamblaje de Interfaz (UI Wiring)
La página principal `app/(command-center)/inbox/page.tsx` orquestará el layout en dos niveles:

*   **Nivel Servidor (`page.tsx`):**
    *   Verificación SSR y redirección si no hay sesión.
    *   Renderiza el Layout base y pasa el `operatorId` al cliente.
*   **Nivel Cliente (`InboxWorkspace` / Contenedor principal):**
    *   Utilizará un layout tipo Split-Pane (CSS Grid o Flexbox con paneles redimensionables).
    *   **Izquierda:** `<InboxList />` - Contiene la lista paginada de hilos.
    *   **Derecha:** `<InboxThreadView />` - Muestra el detalle del hilo seleccionado (estado derivado del URL param o estado local en Zustand).

## 4. Integración de Datos (TanStack Query v5 & SSE)

### 4.1. Consultas y Paginación (Queries)
*   **Listado de Hilos:** Se usará `useInfiniteQuery` apuntando a `/api/threads`. El parámetro de cursores o páginas se gestionará internamente, usando el `operatorId` disponible en Zustand para contexto (si es necesario).
*   **Detalle de Hilo:** Se usará `useQuery` apuntando al endpoint de detalle (o extrayendo datos iniciales del listado para carga optimista).

### 4.2. Mutaciones (Handoff)
*   **Handoff Mutation:** Se implementará un `useMutation` para enviar `POST` a `/api/threads/[id]/handoff`.
*   **Optimistic Updates / Invalidation:** Al tener éxito la mutación, se ejecutará un `queryClient.invalidateQueries({ queryKey: ['threads'] })` para refrescar la lista, además de actualizar el estado del hilo actual.

### 4.3. Tiempo Real (SSE)
*   **Hook Dedicado (`useInboxEvents`):** Un hook de React instanciará un `EventSource` apuntando a `/api/threads/events` al montarse el `InboxWorkspace`.
*   **Actualización de Caché:** Cuando se reciba un evento (ej. nuevo mensaje o cambio de estado), en lugar de re-fetchear agresivamente, el hook usará `queryClient.setQueryData` para inyectar la actualización directamente en la caché activa de TanStack Query, logrando UI reactiva con 0 latencia de red adicional.

---

## 5. Work Breakdown Structure (WBS) Granular

*   [ ] **Fase 1: Preparación del Contexto de Autenticación (Auth)**
    *   [ ] 1.1 Crear el `useAuthStore` en Zustand (alojará `operatorId` y datos de sesión).
    *   [ ] 1.2 Implementar el mecanismo de validación SSR en `app/(command-center)/inbox/page.tsx`.
    *   [ ] 1.3 Crear el wrapper `<InboxClientProvider>` para hidratar el store con los props del servidor.
*   [ ] **Fase 2: Estructura del Layout (UI)**
    *   [ ] 2.1 Crear el componente `<InboxWorkspace>` definiendo el grid CSS (Sidebar + Main Area).
    *   [ ] 2.2 Integrar placeholders de `<InboxList>` e `<InboxThreadView>` para validar responsividad.
    *   [ ] 2.3 Conectar navegación: Seleccionar un elemento en `<InboxList>` actualiza el ID activo para `<InboxThreadView>` (recomendado: reflejar en la URL via `?threadId=...`).
*   [ ] **Fase 3: Data Fetching (TanStack Query)**
    *   [ ] 3.1 Crear hooks de consulta: `useThreadsList(filters)` usando `useInfiniteQuery`.
    *   [ ] 3.2 Integrar el listado real en `<InboxList>` manejando estados de carga (skeletons) y errores.
    *   [ ] 3.3 Crear hook de mutación: `useHandoffThread()`.
    *   [ ] 3.4 Conectar el botón de Handoff en `<InboxThreadView>` a la mutación y manejar `onSuccess` invalidando la caché.
*   [ ] **Fase 4: Integración en Tiempo Real (SSE)**
    *   [ ] 4.1 Crear el hook de conexión `useThreadEvents()`.
    *   [ ] 4.2 Configurar listeners del `EventSource` y lógica de reconexión.
    *   [ ] 4.3 Vincular eventos entrantes a métodos de caché `queryClient.setQueryData` para listado y detalle activo.
