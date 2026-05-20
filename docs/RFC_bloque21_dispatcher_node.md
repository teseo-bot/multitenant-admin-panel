# RFC-BLOQUE-21: Dispatcher Node — Emisión Omnicanal y Doble Persistencia

> **Documento de Diseño Arquitectónico**  
> Proyecto: CRM-Agéntico (Teseo-AI-CRM)  
> Autor: Builder (Arquitecto Staff)  
> Estatus: Draft → Pendiente Aprobación  
> Fecha: 2026-04-24  
> Bloque: 21  

## 1. Contexto y Objetivo
El nodo actual de `dispatcher.ts` fue construido como un stub estático que hardcodea if/else para WhatsApp y Telegram, ignorando la reciente arquitectura de `GenericMessage` y el multi-tenancy. No soporta correo electrónico (Email), Web Chat, ni sincroniza la respuesta final del agente con la base de datos `messages` (Inbox Humano del Tenant OS).

**Objetivo:** Rediseñar el `dispatcherNode` para:
1. Agnosticismo de Canal.
2. Persistencia en Base de Datos vía `TenantScopedClient` (Doble escritura).
3. Manejo de escalamiento de Fallos de Envío.

## 2. Decisiones Arquitectónicas

### 2.1 Factory Inverso de Adaptadores
De la misma forma que usamos `AdapterFactory.getAdapter(channel)` para la ingesta, los adaptadores deben implementar un método inverso de salida. Por limpieza, esto se manejará a través de una nueva clase/fábrica `ChannelEmitter` o expandiendo la interfaz `ChannelAdapter` existente.
- **WhatsApp**: API Cloud de Meta.
- **Telegram**: API de Bot de Telegram.
- **Email**: Resend API o Nodemailer (usando variables del tenant).
- **Web / Forms**: Emisión por Webhook, SSE (Server-Sent Events) o persistencia pasiva para polling.

### 2.2 Doble Persistencia Transaccional (Inbox)
La respuesta de la IA debe reflejarse en tiempo real en la bandeja de entrada del Tenant OS para que el humano tenga el contexto completo si necesita intervenir.
- Se usará `TenantScopedClient` para insertar en la tabla `messages` simulando que la IA es un usuario con el flag `is_ai = true`.
- Esto previene fugas de datos y respeta el RLS del Bloque 20.

### 2.3 Manejo de Errores e Idempotencia
- Si la emisión a la API externa (Meta/Telegram) falla, el error debe capturarse pero NO debe bloquear a LangGraph ni arrojar una excepción fatal. El estado se enrutará al final (`END`), pero un registro de DLQ (Dead Letter Queue) deberá generarse o anotarse en el log del mensaje en la base de datos.

## 3. Plan de Implementación (WBS)
1. **Actualizar `adapters/types.ts`**: Añadir el método `sendMessage(recipient: string, content: string, metadata: any): Promise<void>` a `ChannelAdapter`.
2. **Actualizar Adaptadores Existentes**: Implementar la capa de envío en WhatsApp, Telegram y Email.
3. **Refactorizar `nodes/dispatcher.ts`**:
   - Eliminar los imports rígidos y los ifs hardcodeados.
   - Insertar el mensaje emitido por el modelo en `supabase_client.from('messages').insert(...)`.
   - Llamar a `AdapterFactory.getAdapter(channel).sendMessage(...)`.
4. **Testing**: Validar que un fallo en Telegram no tire la persistencia en DB, y viceversa.
