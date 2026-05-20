# RFC-044: Prompts Management UI

## 1. Objetivo
Completar la primera fase del Asset Studio renderizando la lista de Prompts del Tenant utilizando datos reales desde Supabase y cumpliendo los estándares visuales de Next.js.

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. API & Backend
- **Route Handler:** `GET /api/asset-studio/prompts`.
- **Query Strategy:** Se hace un JOIN optimizado utilizando la sintaxis de PostgREST de Supabase (`prompt_versions!active_version_id`) para traer, en una sola llamada de I/O, el template padre y el contenido de su versión activa.
- **Formateo:** El backend "aplana" (flattens) la estructura anidada de base de datos para entregar una interfaz TypeScript limpia al frontend (`activeVersion: { id, number, status, content }`).

### 2.2. Presentación (Frontend)
- **Caché:** Hook `use-prompts.ts` en `TanStack Query` con un `staleTime` de 5 minutos, garantizando navegación fluida entre pestañas del Asset Studio sin peticiones redundantes.
- **Componente Principal:** `PromptsTable.tsx` utilizando la suite `Table` de shadcn.
- **UX de Estado:** Implementación de Badges para denotar visualmente si un rol está "No Activo" o si tiene una versión `v1` activa. 
- **Internacionalización:** Uso de `date-fns` (es locale) para mostrar "hace 5 minutos" en lugar de timestamps crudos.

## 3. Resultado de Auditoría (Tester)
- **Compilador:** `npx tsc --noEmit` completó con **código 0**. Tipados estrictos alineados.
- **Performance:** Cero CLS (Skeletons inyectados).

---
**Siguiente Paso Natural:**
Implementar la Vista de Detalle / Edición (`/asset-studio/prompts/[id]`), donde el usuario podrá utilizar un Editor de Código (Monaco/CodeMirror) para modificar el `content`, y hacer un POST para generar una nueva versión (v2) en el historial inmutable.
