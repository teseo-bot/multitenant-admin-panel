# RFC-045: Prompt Editor y Control de Versiones

## 1. Contexto
La tabla `prompt_versions` de la BD es inmutable. Cada vez que un usuario edita un Prompt, no se hace un `UPDATE` de la fila actual, sino un `INSERT` de una nueva versión y luego un `UPDATE` en el `prompt_templates` para apuntar a la nueva versión como activa.

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. UI del Editor
Para mantener el Performance y la estabilidad en Next.js (y evitar configuraciones pesadas de Webpack en este momento), utilizaremos el componente nativo `Textarea` de shadcn con clase `font-mono`, suficiente para la edición de Prompts (TXT o JSON).
- Panel principal: Edición de `content`.
- Panel lateral o Metadata: Información de Variables detectadas (ej. `{{company_name}}`).

### 2.2. Flujo de Mutación (API)
Crearemos el Route Handler `POST /api/asset-studio/prompts/[id]/versions` que realizará una transacción SQL de 2 pasos:
1. Insertar en `prompt_versions` (template_id = [id], version_number = previous + 1, content = nuevo_contenido).
2. Actualizar `prompt_templates` (`active_version_id` = nueva_version.id).

### 2.3. Route Handlers a crear
- `GET /api/asset-studio/prompts/[id]` -> Fetch del template y su versión activa para cargar en el editor.
- `POST /api/asset-studio/prompts/[id]/versions` -> Guardar nueva versión.

## 3. Plan de Acción (Night Coder)
1. Escribir los endpoints en Next.js.
2. Crear los hooks `use-prompt(id)` y `use-save-prompt()`.
3. Crear la vista `/app/(dashboard)/asset-studio/prompts/[id]/page.tsx` con un formulario reactivo controlado (`react-hook-form`).

---
**Aprobación Pendiente.**
