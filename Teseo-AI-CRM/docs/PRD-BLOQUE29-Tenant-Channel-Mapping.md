# PRD - Bloque 29: Tenant-Channel Mapping (Conmutador Inteligente)

## 1. Objetivo de Negocio
Implementar un "conmutador inteligente" que resuelva de forma dinámica a qué inquilino (Tenant) pertenece un mensaje entrante, mapeando el identificador del canal (ej. número de teléfono de WhatsApp, webhook de Telegram) hacia el espacio aislado del cliente correspondiente.

## 2. Requerimientos Core
1. **Resolución Dinámica:** Cuando llega un payload al webhook general, el sistema debe consultar la base de datos para mapear el `channel_identifier` (origen/destino) hacia un `tenant_id` específico.
2. **Inyección de Contexto:** El `tenant_id` resuelto debe inyectarse en el contexto de la petición de forma inmutable, activando las políticas de Row Level Security (RLS) para todo el ciclo de vida del request.
3. **Escalabilidad Zero-Deploy:** Agregar, modificar o eliminar un canal de comunicación para un Tenant debe ser estrictamente una operación de base de datos. Está prohibido requerir un redespliegue de código para habilitar nuevos clientes/canales.
4. **Aislamiento Vectorial:** El orquestador (LangGraph/AI) debe instanciarse limitando el alcance de sus herramientas y su base de conocimiento (RAG) exclusivamente al Tenant resuelto.

## 3. Criterios de Aceptación
- [ ] La tabla de mapeo `tenant_channels` (o similar) existe en la base de datos maestra de Supabase.
- [ ] El Middleware/Webhook de entrada intercepta exitosamente los payloads y resuelve el `tenant_id` en O(1) o mediante caché.
- [ ] La sesión del Agente y el cliente de BD se instancian operando al 100% bajo el RLS del Tenant asignado.
- [ ] Rechazo explícito (Fail-Safe): Si un mensaje llega de un canal no registrado, el sistema debe descartarlo limpiamente sin exponer datos ni arrojar errores 500 no controlados.