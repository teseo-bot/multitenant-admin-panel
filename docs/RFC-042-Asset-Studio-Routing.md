# RFC-042: Asset Studio Base Routing (Phase 1)

## 1. Contexto
El Asset Studio es el centro de mando donde el usuario final (Tenant) configura el comportamiento de su LangGraph Orquestador. Debe soportar la inyección de Prompts base, Documentos (RAG) y Variables de entorno dinámicas. 

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. Topología de Next.js App Router
Se extenderá el grupo de rutas protegido `(dashboard)` para incluir el bloque de Asset Studio, manteniendo la persistencia visual del Sidebar y Header.

Rutas a crear:
- `/app/(dashboard)/asset-studio/page.tsx` -> Redirección automática a `/prompts` o un Overview dashboard ligero.
- `/app/(dashboard)/asset-studio/prompts/page.tsx` -> Lista principal de Prompts del sistema (SDR, Gatekeeper, Hunter).
- `/app/(dashboard)/asset-studio/documents/page.tsx` -> Gestor de PDFs/Txt para el Agent RAG.
- `/app/(dashboard)/asset-studio/variables/page.tsx` -> Inyección de Key-Values personalizados (ej. Tono de voz, Nombre empresa).

### 2.2. Diseño de Interfaz Base (UI)
- Cada submódulo utilizará un `PageHeader` estándar.
- Se implementará una vista de tabla de datos (`DataTable` de shadcn/TanStack Table) o grilla de tarjetas para listar los assets, priorizando operaciones CRUD veloces.

## 3. Plan de Acción (Night Coder)
1. **Andamiaje Inicial:** Crear la estructura de carpetas en Next.js.
2. **Page Stubs:** Inyectar "Placeholders" funcionales (`page.tsx`) en cada sub-ruta para validar la navegación desde el Sidebar (actualizado en RFC-041).
3. **Redirección Raíz:** Configurar `next.config.js` o el `page.tsx` de `/asset-studio` para redirigir a `/asset-studio/prompts`.

---
**Fase de Ejecución en espera.**
