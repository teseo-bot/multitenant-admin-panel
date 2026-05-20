# IMPACT REPORT: Kanban in Command Center

## 1. Componentes Shadcn/UI a Instalar
Tras inspeccionar `crm-agentico-panel/components/ui/`, los siguientes componentes requeridos por el RFC **NO existen** y el Ejecutor debe instalarlos:
- `Card`
- `Badge`
- `Avatar`
- `DropdownMenu`

*(Nota: `ScrollArea` ya se encuentra instalado y disponible en `scroll-area.tsx`).*

**Comando sugerido para el Ejecutor:**
```bash
npx shadcn-ui@latest add card badge avatar dropdown-menu
```

## 2. Dependencias de dnd-kit
El Ejecutor debe instalar el motor de Drag & Drop seleccionado, el cual es consistente y está validado en nuestra base de conocimientos (ADR-018 y memorias anteriores).

**Comando sugerido para el Ejecutor:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## 3. Integración en el Layout (Rutas)
El RFC dictamina: *"Interfaz de Tabs para alternar/integrar el Inbox clásico y el Tablero Kanban."*
Al inspeccionar `app/(command-center)/inbox/`, se detectó que el layout (`layout.tsx`) divide la pantalla en un Panel Resizable (30/70) con `children` y `@detail`.

**Directiva para el Ejecutor:**
- Modificar `app/(command-center)/inbox/page.tsx` para incorporar Tabs o un Toggle que permita cambiar entre la vista de "Lista Clásica" y "Kanban Board".
- Crear un nuevo directorio `components/kanban/` dentro del scope del panel para alojar los sub-componentes (`KanbanBoard`, `KanbanColumn`, `KanbanCard`).
- Implementar la mutación optimista con TanStack Query como señala el RFC.

## 4. Estado Local y dnd-kit (Reglas TeseoKDB)
Se validó a través de la memoria histórica y la base de conocimiento (TeseoKDB) que **no existen reglas prohibitivas** respecto al uso de `@dnd-kit` o estado local (Zustand/TanStack Query) para Kanbans. De hecho, el uso de `@dnd-kit` se alinea con decisiones arquitectónicas previas (ADR-018). La mutación optimista a nivel local/caché es el camino correcto para garantizar un "Zero-latency feel" sin conflictos.