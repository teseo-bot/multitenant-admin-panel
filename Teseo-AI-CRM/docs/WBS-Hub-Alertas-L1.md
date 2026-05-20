# WBS / RFC: Hub de Alertas L1 en Mission Control

## 1. Objetivo y Contexto
Diseñar la arquitectura técnica para centralizar, recibir y gestionar alertas L1 provenientes de los orquestadores (Tenants, Cloud Run, LangGraph). Actualmente los orquestadores ya preparan el envío (ej. en `alert.ts`), por lo que Mission Control debe exponer un webhook de ingesta y un dashboard para la gestión operativa.

---

## 2. Esquema de Base de Datos (Supabase)
Se creará la tabla `l1_alerts` para persistir los eventos recibidos.

**Tabla:** `l1_alerts`
| Columna | Tipo | Restricciones / Default | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, `uuid_generate_v4()` | Identificador único de la alerta |
| `tenant_id` | `text` | Not Null, Indexed | ID del tenant origen para filtrado rápido |
| `source` | `text` | Not Null | Origen del fallo (ej. `orchestrator`, `langgraph`, `webhook`) |
| `level` | `text` | Not Null | Nivel de severidad (`info`, `warn`, `error`, `critical`) |
| `message` | `text` | Not Null | Mensaje descriptivo de la alerta |
| `details` | `jsonb` | Nullable | Stacktrace, headers, variables u otro contexto adicional |
| `status` | `text` | Default `'active'` | Estado actual de la alerta (`active`, `resolved`, `ignored`) |
| `created_at`| `timestamptz` | Default `now()` | Fecha de ocurrencia |
| `resolved_at`| `timestamptz` | Nullable | Fecha de resolución o ignorado |

**RLS (Row Level Security):**
- **Insert:** Protegido/Cerrado al lado del cliente. Las inserciones ocurren mediante el rol `Service Role` del Route Handler.
- **Select/Update:** Solo permitido para usuarios autenticados en el Dashboard de Mission Control (Administradores).

---

## 3. Webhook Receptor (Route Handler)

Se implementará un Route Handler en Next.js App Router para recibir los POST requests.

- **Ruta:** `src/mission-control/src/app/api/webhooks/alerts/route.ts`
- **Autenticación Server-to-Server:**
  - Se usará el header HTTP `x-api-key`.
  - El valor será validado contra una variable de entorno en Mission Control: `ALERTS_API_KEY`.
- **Payload Esperado (Ingesta):**
  ```json
  {
    "tenant_id": "tenant-abc-123",
    "source": "orchestrator",
    "level": "error",
    "message": "Fallo en la conexión a la base de datos",
    "details": { "query": "SELECT *", "error_code": "503" }
  }
  ```
- **Flujo de Ejecución:**
  1. Validar presencia y match del header `x-api-key`.
  2. Parsear el JSON del body.
  3. Validar esquema con Zod (opcional pero recomendado para consistencia).
  4. Insertar registro en Supabase mediante el cliente `supabase-admin`.
  5. Retornar `201 Created` con confirmación de recepción.

---

## 4. Componentes UI (Dashboard con Shadcn)

Se creará una vista específica en Mission Control para el monitoreo y gestión de estas alertas.

- **Ruta del Dashboard:** `src/mission-control/src/app/alerts/page.tsx`
- **Layout y Componentes Visuales:**
  - **Métricas Top (Cards):** Tarjetas con recuentos de alertas por severidad (Críticas, Errores).
  - **Tabla Principal (`DataTable` de Shadcn UI):**
    - **Nivel:** Renderizado visual con `Badge` (Rojo para critical, Naranja para error).
    - **Tenant:** Identificador del cliente.
    - **Mensaje y Origen:** Resumen del problema.
    - **Fecha:** Formateada humanamente (`date-fns` o `dayjs`).
    - **Acciones:** Botón para marcar como "Resuelta" o "Ignorada" (gatilla Server Actions).
  - **Detalle Modal (Dialog/Sheet de Shadcn):** Al hacer clic en una fila, se abrirá un panel lateral o modal que mostrará el bloque crudo en JSON (`<pre>`) de la columna `details` para debugging de bajo nivel.

- **Manejo de Estado y Mutaciones (Server Actions):**
  Se creará un archivo `src/mission-control/src/app/actions/alerts.ts` para manejar la lógica de estado:
  - `resolveAlert(alertId: string)`: Actualiza el estado a `resolved` y asienta el `resolved_at`.

---

## 5. Plan de Ejecución sugerido (Para el Agente Ejecutor)
1. **Paso 1:** Generar y ejecutar la migración SQL en Supabase para la tabla `l1_alerts` y sus políticas RLS.
2. **Paso 2:** Crear el endpoint POST `/api/webhooks/alerts` aplicando la validación de `x-api-key` e inserción con Supabase Admin.
3. **Paso 3:** Implementar los Server Actions de Next.js para interactuar con la tabla (Query de lectura y Update de estado).
4. **Paso 4:** Maquetar la UI en `app/alerts/page.tsx` importando componentes de Shadcn (Table, Badge, Card, Sheet/Dialog) y conectarlos a los datos en vivo.