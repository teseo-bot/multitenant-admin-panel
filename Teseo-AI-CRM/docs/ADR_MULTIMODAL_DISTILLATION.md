# ADR: Embudo de Destilación Multimodal para RAG (FleetcoBot / Teseo-AI-CRM)

## 1. Contexto y Problema
Actualmente, el sistema ingiere conocimiento a través del nodo `Gatekeeper` al detectar el comando `[LEARN]` en un mensaje. Cuando esto ocurre, el Gatekeeper lanza un job a `pg-boss` (Minion Worker) que vectoriza el texto e inserta el embedding en PostgreSQL (`tenant_memories`). 
El problema crítico es que el sistema asume que el input es siempre texto plano. Si un usuario envía una imagen, nota de voz o video acompañados del caption `[LEARN] Esto es un manual`, los assets multimedia son ignorados por los adaptadores y por el Gatekeeper, perdiendo conocimiento valioso.

## 2. Decisión Arquitectónica
Se implementará un **Embudo de Destilación Multimodal Asíncrono**. En lugar de bloquear la respuesta del webhook para descargar y procesar medios (lo que generaría timeouts y mala UX), la destilación ocurrirá en el *background* dentro del Minion Worker (`pg-boss`), justo antes de la vectorización.

El flujo será el siguiente:
1. **Webhook/Adapter:** Extrae no solo el texto/caption, sino los `ids` (o URLs) de los medios adjuntos y los inyecta en el objeto `GenericMessage`.
2. **State de LangGraph:** Transporta la referencia de los medios sin saturar la RAM con Buffers masivos.
3. **Gatekeeper:** Al detectar `[LEARN]`, adjunta el array de medios al payload del job enviado a `pg-boss`.
4. **Minion Worker (Destilador):** Al procesar el job `gbrain_learn`, si detecta assets en `metadata.media`:
   - Descarga el media desde la API origen (ej. WhatsApp Media API).
   - Inyecta el buffer/base64 junto al caption original en un LLM Multimodal (ej. `gemini-1.5-flash`).
   - El LLM genera una transcripción/descripción detallada (Destilación).
   - El texto resultante destilado se pasa al motor de embeddings (`gemini-embedding-2-preview`) y se inserta en la base de datos.

## 3. Modificaciones al Esquema de `State` en LangGraph
Se modificará la entidad agnóstica `GenericMessage` (en `adapters/types.ts`) para soportar el transporte de metadatos multimedia.

```typescript
// En src/adapters/types.ts
export interface MediaAsset {
  type: 'image' | 'audio' | 'video' | 'document';
  id?: string;       // ID del proveedor (ej. WhatsApp Media ID)
  url?: string;      // URL directa si aplica
  mimeType?: string;
}

export interface GenericMessage {
  id: string;
  channel: 'whatsapp' | 'telegram' | 'web' | 'email';
  senderId: string;
  text: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  media?: MediaAsset[]; // <-- NUEVO: Transporte de assets multimodales
}
```
Esto asegura que el estado `GraphState.genericMessage` pueda contener y propagar los apuntadores a las imágenes/audios hacia los nodos.

## 4. Plan de Implementación (Bottom-Up) para el Ejecutor

### Fase 1: Adaptadores y Estado (Transporte)
- [ ] Modificar `src/adapters/types.ts` agregando el campo `media?: MediaAsset[]` a la interfaz `GenericMessage`.
- [ ] Modificar `src/adapters/whatsapp.adapter.ts` (y otros canales activos):
  - Detectar si `message.type` es `image`, `audio`, `video`, o `document`.
  - Extraer el ID del medio (`message.image.id`, `message.audio.id`, etc.) y el MIME type.
  - Extraer el texto preferentemente de `message.text.body` o del `caption` de la imagen/video.
  - Poblar el array `media` del objeto de retorno.
- [ ] Modificar `src/index.ts` (Webhook Handler):
  - Modificar cómo se construye `HumanMessage`. Aunque se puede usar la estructura multimodal de LangChain, por simplicidad y compatibilidad con prompts actuales, crear el `HumanMessage` con el texto/caption extraído, pero confiar en `genericMessage.media` que ahora se transporta en el GraphState.

### Fase 2: Intercepción en Gatekeeper
- [ ] Modificar `src/nodes/gatekeeper.ts`:
  - En la intercepción de la etiqueta `[LEARN]`, el código actual lee `match[1]` del contenido.
  - Asegurarse de que soporta arrays si en el futuro LangGraph inyecta arreglos en `lastMessage.content` (usar una función para extraer texto plano).
  - Al despachar el job, incluir `media: state.genericMessage?.media` dentro de la carga útil:
    ```typescript
    await dispatchMemoryJob(tenantId, contentToLearn, { 
      source: "chat_interception",
      media: state.genericMessage?.media 
    });
    ```

### Fase 3: Minion Worker (Destilador Multimodal)
- [ ] Modificar `src/worker/daemon.ts` (o crear un módulo `distiller.ts` auxiliar):
  - En la función que atiende la cola `gbrain_learn`, revisar si `payload.metadata.media` contiene assets.
  - Si existen assets:
    - **Download:** Hacer fetch a la API correspondiente (ej. WhatsApp) usando el Media ID para obtener el binario (Buffer) y convertirlo a Base64.
    - **Distill:** Llamar a la API generativa (Gemini 1.5 Flash/Pro) usando `@google/generative-ai` enviando el Base64 (con su `mimeType`) y un prompt del tipo: *"Analiza este archivo (imagen/audio/documento). Describe todo el contenido visual, extrae el texto exacto (OCR) o transcribe el audio de forma detallada. Contexto adicional del usuario: ${payload.content}"*.
    - **Merge:** Concatenar la descripción generada por Gemini con el caption original del usuario.
  - Pasar el texto enriquecido final a `generateEmbedding()`.
  - Ejecutar el `INSERT` en `tenant_memories`.
- [ ] Asegurarse de inyectar variables de entorno necesarias para la descarga de media (ej. el token de acceso a la API de WhatsApp Cloud).
