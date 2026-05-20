# RFC: Dynamic Tenant-Channel Mapping

## 1. Contexto y Motivación
Actualmente, el enrutamiento de mensajes provenientes de canales externos (Telegram, WhatsApp) requiere asociar los identificadores técnicos de los canales con un `tenant_id` específico. Para garantizar una arquitectura multi-tenant real, escalable y administrable desde Mission Control, es imperativo eliminar cualquier asociación estática o hardcodeada en el código fuente.

Este RFC propone un diseño arquitectónico para mapear de forma dinámica canales de mensajería con los tenants correspondientes, utilizando Supabase como fuente de verdad y optimizando el acceso desde LangGraph.

## 2. Diseño de Base de Datos (Supabase)
Se propone la creación de una nueva tabla `tenant_channels` que actuará como el registro central de asociaciones.

### Esquema de la tabla `tenant_channels`
*   **`id`** (UUID, PK): Identificador único del registro.
*   **`tenant_id`** (UUID, FK): Referencia a la tabla principal de `tenants`.
*   **`channel_type`** (String/Enum): Tipo de canal (ej. `'telegram'`, `'whatsapp'`, `'instagram'`).
*   **`channel_identifier`** (String): Identificador único provisto por la plataforma externa (ej. Bot ID en Telegram, Phone Number ID en WhatsApp).
*   **`credentials`** (JSONB, Opcional): Tokens de acceso o configuraciones específicas del canal (encriptados a nivel de aplicación o mediante extensiones como `pgcrypto` si es necesario).
*   **`is_active`** (Boolean): Bandera para habilitar o deshabilitar el enrutamiento desde este canal (Default: `true`).
*   **`created_at`** / **`updated_at`** (Timestamps).

**Restricciones:**
*   Se debe aplicar una restricción `UNIQUE(channel_type, channel_identifier)` para evitar que un mismo bot de Telegram o número de WhatsApp sea asignado a múltiples tenants simultáneamente.

## 3. Integración con Mission Control
El panel de control (Mission Control) expondrá una interfaz para la gestión de esta tabla:
1.  **Asignación:** Seleccionar un Tenant y registrar un nuevo canal de comunicación proporcionando el Tipo y el Identificador.
2.  **Toggle de estado:** Habilitar o deshabilitar temporalmente la entrada de mensajes (`is_active`).
3.  **Auditoría:** RLS (Row Level Security) permitirá que solo los usuarios administradores del Mission Control modifiquen estas rutas, mientras que los trabajadores del backend tendrán permisos de solo lectura o usarán la Service Role Key para resolución.

## 4. Resolución en LangGraph (Tiempo Real)
Dado que LangGraph orquesta la lógica de negocio por cada mensaje entrante, la resolución del `tenant_id` debe ser inmediata para no introducir latencia.

### Flujo de Resolución (Middleware / Primer Nodo)
1.  **Recepción (Webhook):** El webhook recibe el payload. Se extrae de forma inmediata el `channel_type` (de la URL del webhook o cabeceras) y el `channel_identifier` (del cuerpo del mensaje).
2.  **Capa de Caché (Redis / Upstash):**
    *   Se consulta la clave `routing:{channel_type}:{channel_identifier}`.
    *   Si hay *Cache Hit*, se retorna el `tenant_id` inmediatamente.
3.  **Capa de Fallback (Supabase):**
    *   Ante un *Cache Miss*, el sistema realiza una consulta a la tabla `tenant_channels` vía Supabase RPC o SDK directo.
    *   Si se encuentra y `is_active == true`, se actualiza el Caché con un TTL razonable (ej. 1 hora) y se retorna el `tenant_id`.
    *   Si no se encuentra, la solicitud es rechazada (Drop) con un log de "Canal no registrado".
4.  **Inyección en GraphState:** El `tenant_id` resuelto se inyecta en el estado principal del grafo (`GraphState`), de forma que todos los agentes subsecuentes (Learner, Ejecutor, etc.) y las herramientas operen con el contexto aislado de ese tenant.

## 5. Criterios de Aceptación
*   [ ] Tabla `tenant_channels` creada con RLS estricto.
*   [ ] UI de Mission Control actualizada para soportar operaciones CRUD sobre la nueva tabla.
*   [ ] Función de resolución (Node Middleware) integrada en LangGraph usando patrón Caché-Fallback.
*   [ ] No existen IDs de Telegram o WhatsApp hardcodeados en el flujo de entrada.

---
*Documento generado por el Agente Builder. Proyecto: Teseo-AI-CRM.*