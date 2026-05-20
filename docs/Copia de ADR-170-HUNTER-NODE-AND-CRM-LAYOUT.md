# ADR 170: Hunter Node and CRM Layout Refactor

## Contexto
El Inbox ya recibe actualizaciones por SSE. La prioridad es habilitar el pase a Pipeline y la operación del Vendedor de forma reactiva y estructurada.

## Decisiones
1. **Hunter Node (Backend):** LangGraph debe tener un nuevo nodo "Hunter" que busque datos contextuales del Lead (OSINT) y los almacene en Postgres (Neon Tech).
2. **Validación de Pipeline (Backend):** La lógica de pase a Pipeline requiere validación estricta de `nombre`, `teléfono`, `correo` y `necesidad`.
3. **Layout Frontend (Next.js - Mission Control):**
   - Panel principal de Chat (70% viewport).
   - Sidebar o panel inferior para Resumen Semántico y Expediente Hunter.
   - Toolbar fixed.
   - Sincronización vía SSE para refresco automático de labels, etapas y valor.

## Consecuencias
- Mayor acoplamiento con SSE y LangGraph en las vistas del Vendedor.
- El esquema de Postgres debe almacenar la metadata de "Hunter".
