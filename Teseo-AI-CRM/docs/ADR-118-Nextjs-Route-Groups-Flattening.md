# ADR-118: Next.js Route Group Flattening y Prevención de Colisiones (App Router)

**Fecha:** 21 Abril 2026
**Estado:** Aceptado
**Contexto:**
Durante la integración de las Fases 0-4 del Command Center UI (`crm-agentico-panel`), el entorno de Next.js colapsó (Error 500 fatal: `Error: You cannot have two parallel pages that resolve to the same path.`). 
El problema derivó del uso extensivo de Route Groups con paréntesis (ej. `(asset-studio)`, `(campaign-review)`, `(command-center)`) en la raíz del directorio `app/`. En Next.js, las carpetas con paréntesis se ignoran en la URL, lo que causó que múltiples archivos `page.tsx` intentaran montarse sobre la ruta raíz (`/`) simultáneamente.

**Decisión:**
1. **Abolición de Route Groups Raíz:** Se prohíbe el uso de Route Groups `(folder-name)` para separar módulos principales en la raíz de la aplicación.
2. **Rutas Físicas Explícitas:** Todos los módulos principales deben estar en carpetas de ruta estándar (`/asset-studio`, `/campaign-review`, `/command-center`).
3. **Punto de Entrada Restringido:** El archivo `app/page.tsx` base queda estrictamente como un middleware visual/redireccionador (actualmente apunta a `/command-center`).

**Consecuencias:**
- **Positivas:** Compilación segura y predecible. Ausencia de "White Screens of Death" causadas por ambigüedad de ruteo. Las URLs reflejan exactamente la estructura de módulos de la aplicación.
- **Negativas:** Las URLs se vuelven ligeramente más largas, pero es preferible en arquitecturas B2B/SaaS para mantener el estado de la vista de forma unívoca.