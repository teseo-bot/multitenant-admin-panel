# Arquitectura: Webhook de WhatsApp (Hono) para LangGraph

## 1. Visión General
Este documento define la estructura del controlador del Webhook desarrollado en Hono. Su propósito principal es actuar como la frontera segura entre la Graph API de Meta (WhatsApp) y nuestro flujo de agentes en LangGraph, garantizando la concurrencia segura, la validación estricta y la correcta inyección de estado.

---

## 2. Validación del Payload

El Webhook debe exponer dos rutas principales en el mismo endpoint (ej. `/api/webhook`):

### A. GET: Verificación de Meta (Setup)
Meta enviará un request `GET` para validar la propiedad del Webhook.
*   **Extracción:** Capturar los query parameters `hub.mode`, `hub.verify_token`, y `hub.challenge`.
*   **Validación:** Comprobar que `hub.mode === 'subscribe'` y que `hub.verify_token` coincida con nuestro secreto en variables de entorno.
*   **Respuesta:** Retornar el `hub.challenge` en texto plano (HTTP 200).

### B. POST: Recepción de Mensajes
Meta enviará un payload JSON con los eventos de WhatsApp.
*   **Validación de Firma:** (Recomendado) Validar el header `X-Hub-Signature-256` usando el App Secret.
*   **Extracción Segura:**
    Navegar de forma segura el árbol del JSON (usando Optional Chaining o Zod):
    ```typescript
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];
    const contact = changes?.contacts?.[0];
    
    // Identificador de hilo (Thread ID)
    const phone = message?.from; 
    const textContext = message?.text?.body;
    ```
*   **Filtro:** Ignorar estados de mensajes (sent, delivered, read) y procesar únicamente mensajes entrantes válidos.

---

## 3. Control de Concurrencia

Dado que Meta puede enviar múltiples mensajes en ráfaga, y LangGraph necesita mantener la coherencia del estado del hilo (`thread_id`), es crítico manejar la concurrencia.

### Implementación Asíncrona
*   **Candado (Lock):** Utilizaremos un sistema de lock distribuido (ej. Redis o memoria si es single-instance) basado en el `phone` (`thread_id`).
*   **Flujo de Bloqueo:**
    1.  Intentar `acquireLock(phone)`.
    2.  Si se obtiene, procesar el mensaje.
    3.  Al finalizar (éxito o error), ejecutar estrictamente en un bloque `finally` el `releaseLock(phone)`.
*   **Estrategia en caso de Lock Ocupado:**
    *   **Opción Recomendada (Cola de Reintentos Interna):** Si el lock no se obtiene (ej. un mensaje anterior está siendo procesado por el LLM), **NO** se debe bloquear la respuesta a Meta. Meta requiere un HTTP 200 OK rápidamente o reintentará el request masivamente y eventualmente desactivará el Webhook. 
    *   **Decisión:** Responder con `HTTP 200 OK` inmediatamente a Meta y enviar el evento a una **Cola de Reintentos interna** (ej. Redis Queue, BullMQ, o QStash). El worker de la cola intentará adquirir el lock con un backoff exponencial hasta que el hilo esté libre.
    *   *(Alternativa descartada: Retornar HTTP 429 obligaría a Meta a gestionar el reintento, pero sus políticas de backoff son opacas y ponen en riesgo la salud del Webhook).*

---

## 4. Ejecución del Grafo

Una vez validado el payload y adquirido el lock, se invoca el flujo de LangGraph.

*   **Preparación del Estado (`GraphState`):**
    Construir el mensaje de entrada mapeando el texto entrante.
    ```typescript
    const initialState = {
      messages: [{ role: "user", content: textContext }]
    };
    ```
*   **Preparación de la Configuración (`config`):**
    Inyectar el número de teléfono como identificador de hilo para la memoria persistente del Grafo.
    ```typescript
    const config = {
      configurable: { thread_id: phone }
    };
    ```
*   **Invocación:**
    ```typescript
    const result = await app.invoke(initialState, config);
    ```

---

## 5. Extracción de Respuesta y Envío (Meta Graph API)

LangGraph procesará el mensaje y retornará el estado actualizado.

*   **Extracción:**
    Obtener el último mensaje generado por el agente (el final del array de `messages`).
    ```typescript
    const finalMessages = result.messages;
    const aiResponse = finalMessages[finalMessages.length - 1];
    ```
*   **Armado del Request:**
    Mapear la respuesta al formato de envío de WhatsApp Cloud API.
    ```typescript
    const postData = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: aiResponse.content }
    };
    ```
*   **Envío (Fetch/Axios):**
    Ejecutar el POST de vuelta a la API de Meta.
    ```typescript
    await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    ```
## 6. Variables de Entorno y Despliegue en GCP (Cloud Run)
Para prevenir colisiones de red en los entornos contenerizados (ej. Google Cloud Run), es imperativo que el entorno de despliegue sobreescriba las variables locales.

**Punto de Falla Conocido:** 
El enrutamiento del LLM por defecto apunta a `http://localhost:4010/v1` (Fleetco AI Gateway). En Cloud Run, `localhost` resuelve al mismo contenedor de la aplicación, ocasionando un fallo de red "Connection Refused".

**Mandato de Configuración:**
Todo despliegue del orquestador debe contener la variable de entorno `AI_GATEWAY_URL` apuntando a la URL interna resoluble (VPC) o URL privada de Cloud Run asignada al Gateway.

```bash
# Ejemplo requerido en producción:
AI_GATEWAY_URL=https://internal-fleetco-ai-gateway-xxxxxxxx.run.app/v1
AI_GATEWAY_TOKEN=fleetco-admin-token
```
