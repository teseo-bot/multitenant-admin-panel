# RFC: Kanban In-House para Gestión de Leads

## 1. Contexto y Objetivos
Implementar un tablero Kanban dentro del módulo *Command Center* del CRM para la gestión visual de Leads. Los Leads deben transicionar entre estados mediante Drag & Drop (D&D) con una experiencia de usuario sin fricciones.

**Estados Base Definidos:**
- `New`
- `Contacted`
- `Qualified`
- `Lost`
- `Won`

## 2. Estrategia D&D (Drag and Drop)
**Decisión:** `@dnd-kit/core` junto con `@dnd-kit/sortable`.
- **Racional:** `dnd-kit` es el estándar moderno para React. A diferencia de `react-beautiful-dnd` (o su fork `@hello-pangea/dnd`), dnd-kit ofrece una arquitectura modular basada en hooks, soporte nativo de accesibilidad (a11y) y una integración limpia con los componentes funcionales de Shadcn/UI sin inyectar estilos invasivos al DOM.
- **Implementación:** Se usará un `DndContext` global para el tablero, y `SortableContext` para cada columna correspondiente a un estado de Lead.

## 3. Abstracción de Datos (TanStack Query y Mutación Optimista)
Para garantizar una experiencia fluida ("Zero-latency feel"), el reordenamiento y cambio de columnas se gestionará con Mutaciones Optimistas usando TanStack Query v5.

**Flujo de `useMutation` para `UpdateLeadStatus`:**
1. **`onMutate`:** 
   - Se intercepta el evento `onDragEnd` de dnd-kit.
   - Se cancelan queries en vuelo (`queryClient.cancelQueries({ queryKey: ['leads'] })`).
   - Se toma un *snapshot* del caché actual.
   - Se actualiza manualmente la caché local moviendo el Lead a la nueva columna/índice.
2. **`onError`:** Si el backend rechaza el cambio, se restaura la vista automáticamente usando el *snapshot*.
3. **`onSettled`:** Se invalida la caché local (`queryClient.invalidateQueries`) para re-sincronizar el estado final real con el servidor.

## 4. Representación Visual (Componentes Shadcn/UI)
El diseño mantendrá un enfoque austero y profesional, integrando los siguientes componentes de Shadcn/UI:
- **Tablero y Columnas:** `ScrollArea` (manejo nativo y elegante de listas largas sin romper el layout del Command Center).
- **Tarjetas de Lead:** `Card`, `CardHeader` (Nombre/Empresa), `CardContent` (Último mensaje/Resumen).
- **Metadatos:** `Badge` (prioridad: High/Medium/Low, o procedencia).
- **Asignación:** `Avatar` en la esquina de la tarjeta indicando el agente responsable.
- **Context Actions:** `DropdownMenu` accesible en la esquina superior de la Card para permitir acciones rápidas (Marcar como perdido, editar, reasignar) para usuarios que prefieren no usar D&D.

## 5. Work Breakdown Structure (WBS) Granular
- **Fase 1: Preparación Base**
  - Instalar dependencias (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).
  - Definir interfaces en TypeScript (`Lead`, `LeadStatusType`).
- **Fase 2: Construcción de UI (Shadcn)**
  - Componente `KanbanBoard` (layout de columnas flex/grid).
  - Componente `KanbanColumn` (contenedor con `SortableContext`).
  - Componente `KanbanCard` (UI del Lead).
- **Fase 3: Implementación D&D**
  - Configurar `DndContext` con colisiones (`closestCorners` o `pointerIntersection`).
  - Hook `useSortable` conectado a los *refs* de las `KanbanCard`.
- **Fase 4: Sincronización de Estado Optimista**
  - Hook personalizado `useMoveLeadMutation` con la lógica de TanStack Query detallada en la sección 3.
  - Vínculo entre el `onDragEnd` y la mutación.
- **Fase 5: Integración al Command Center**
  - Interfaz de Tabs para alternar/integrar el Inbox clásico y el Tablero Kanban.
  - Sincronización de filtros globales (ej. vista de Leads del Agente actual vs Todo el equipo).
