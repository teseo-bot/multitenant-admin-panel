# RFC-005: Centralized Ingestion Gateway

| Campo | Valor |
|-------|-------|
| **Autor** | Builder (subagent) — revisado desde `reporte_ingestion_bloque17.md` |
| **Fecha** | 2026-04-23 |
| **Estado** | DRAFT |
| **Bloque origen** | 17 — Ingestión y Webhooks |

---

## 1. Problema

El orquestador actual presenta tres deficiencias que impiden una ingestión multi-tenant y multi-canal robusta:

1. **`tenantId` depende de `process.env.TENANT_ID`** — El proxy de Mission Control extrae el `tenantId` del path (`/api/webhooks/tenant/[id]/[channel]`) pero solo lo usa para resolver la URL del orquestador; **nunca lo inyecta** en el request que llega al endpoint destino. El orquestador cae a `process.env.TENANT_ID`, lo que impide multi-tenancy real en una instancia compartida.

2. **Ruta de WhatsApp desalineada** — El proxy envía el tráfico a `/api/webhook/whatsapp` pero el orquestador lo recibe en `/api/webhook` (ruta raíz Meta), causando un 404 cuando el proxy actúa como gateway.

3. **Canal Formularios inexistente** — No hay endpoint ni adaptador para webhooks de proveedores de formularios (Tally, Typeform, JotForm, custom).

## 2. Propuesta

Implementar un **Centralized Ingestion Gateway** dentro del orquestador Hono que:

- Reciba un header `x-tenant-id` inyectado por el proxy de Mission Control.
- Estampe `tenantId` en `GenericMessage.metadata` **antes** de invocar el grafo, eliminando la dependencia en `process.env.TENANT_ID` para la resolución de configuración.
- Unifique la lógica duplicada de cada endpoint en un middleware + handler genérico.
- Registre adaptadores mediante un `AdapterFactory` ampliado con soporte para `forms`.

### 2.1 Flujo end-to-end

```
[Webhook externo]
        │
        ▼
┌─────────────────────────┐
│  Mission Control Proxy  │  ← extrae tenantId del path
│  /api/webhooks/tenant/  │  ← inyecta header x-tenant-id
│  [id]/[channel]         │  ← forward a orquestador
└─────────┬───────────────┘
          │ POST /api/webhook/{channel}
          │ Header: x-tenant-id: <uuid>
          ▼
┌─────────────────────────┐
│  Ingestion Gateway      │
│  (Hono middleware)       │
│  1. Extraer x-tenant-id │
│  2. Validar firma canal  │
│  3. AdapterFactory       │
│     .getAdapter(channel) │
│  4. adapter.normalize()  │
│  5. Estampar tenantId    │
│     en metadata          │
│  6. acquireLock → invoke │
│     → releaseLock        │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  LangGraph              │
│  START → hydrate        │
│  state.genericMessage   │
│    .metadata.tenantId ✓ │
└─────────────────────────┘
```

## 3. Diseño técnico

### 3.1 Cambio en Mission Control Proxy

```typescript
// src/mission-control/src/app/api/webhooks/tenant/[id]/[channel]/route.ts
// ANTES del fetch(), inyectar:
headers.set("x-tenant-id", id);
```

Esto garantiza que cada request que llega al orquestador lleva el `tenantId` de forma explícita, independiente de la URL del orquestador (que puede ser compartida).

### 3.2 Tipos — `GenericMessage` y `ChannelAdapter` (sin breaking changes)

```typescript
// src/orchestrator/src/adapters/types.ts

/** Canal soportado por la plataforma. */
export type SupportedChannel = 'whatsapp' | 'telegram' | 'web' | 'email' | 'forms';

/** Metadatos que SIEMPRE incluyen tenantId tras pasar por el gateway. */
export interface MessageMetadata extends Record<string, any> {
  /** UUID del tenant — inyectado por el gateway, NO por el adaptador. */
  tenantId: string;
}

export interface GenericMessage {
  id: string;
  channel: SupportedChannel;
  senderId: string;
  text: string;
  timestamp: Date;
  metadata: MessageMetadata;          // ← ya no es opcional
  media?: Array<{
    type: string;
    mimeType: string;
    id?: string;
    url?: string;
    buffer?: Buffer | string;
  }>;
}

/** Contrato base que todo adaptador de canal debe implementar. */
export interface ChannelAdapter {
  /**
   * Valida la firma o autenticación del request crudo.
   * @returns true si la firma es válida o no aplica.
   */
  verifySignature(rawBody: string, headers: Record<string, string | undefined>): boolean;

  /**
   * Transforma el payload crudo del webhook en un GenericMessage.
   * NOTA: El adaptador NO asigna tenantId — eso es responsabilidad
   * exclusiva del gateway layer para garantizar integridad.
   * El campo metadata.tenantId se deja como placeholder ('') y
   * el gateway lo sobreescribe inmediatamente después.
   */
  normalize(rawPayload: any): GenericMessage;

  /**
   * Extrae el identificador de hilo para el Checkpointer Lock.
   * Cada canal define su propia semántica:
   * - WhatsApp: número de teléfono (message.from)
   * - Telegram: chatId
   * - Forms: email o teléfono del lead
   */
  extractThreadId(genericMsg: GenericMessage): string;
}
```

### 3.3 Contrato del `AdapterFactory`

```typescript
// src/orchestrator/src/adapters/factory.ts

import type { ChannelAdapter, SupportedChannel } from './types.js';
import { WhatsAppAdapter }  from './whatsapp.adapter.js';
import { TelegramAdapter }  from './telegram.adapter.js';
import { FormsAdapter }     from './forms.adapter.js';
import { EmailAdapter }     from './email.adapter.js';
import { WebAdapter }       from './web.adapter.js';

/**
 * Registry-based factory para adaptadores de canal.
 * Permite extensión sin modificar el switch — los plugins
 * pueden registrar adaptadores en tiempo de arranque.
 */
export class AdapterFactory {
  private static registry = new Map<string, () => ChannelAdapter>([
    ['whatsapp', () => new WhatsAppAdapter()],
    ['telegram', () => new TelegramAdapter()],
    ['forms',    () => new FormsAdapter()],
    ['email',    () => new EmailAdapter()],
    ['web',      () => new WebAdapter()],
  ]);

  /**
   * Registra un adaptador personalizado para un canal.
   * Útil para plugins o canales custom del tenant.
   */
  static register(channel: string, factory: () => ChannelAdapter): void {
    AdapterFactory.registry.set(channel.toLowerCase(), factory);
  }

  /**
   * Obtiene una instancia del adaptador para el canal indicado.
   * @throws Error si el canal no tiene adaptador registrado.
   */
  static getAdapter(channel: SupportedChannel | string): ChannelAdapter {
    const key = channel.toLowerCase();
    const factory = AdapterFactory.registry.get(key);
    if (!factory) {
      throw new Error(`No adapter registered for channel '${channel}'`);
    }
    return factory();
  }

  /** Lista los canales con adaptadores registrados. */
  static supportedChannels(): string[] {
    return [...AdapterFactory.registry.keys()];
  }
}
```

### 3.4 Firmas de los tres adaptadores nuevos/actualizados

#### 3.4.1 `WhatsAppAdapter` (actualizado)

```typescript
// src/orchestrator/src/adapters/whatsapp.adapter.ts

import crypto from 'crypto';
import type { ChannelAdapter, GenericMessage } from './types.js';

export class WhatsAppAdapter implements ChannelAdapter {

  verifySignature(rawBody: string, headers: Record<string, string | undefined>): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret) return true; // Sin secret configurado, skip validación
    const signature = headers['x-hub-signature-256'];
    if (!signature) return false;
    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  normalize(rawPayload: any): GenericMessage {
    const entry    = rawPayload.entry?.[0];
    const change   = entry?.changes?.[0];
    const value    = change?.value;
    const message  = value?.messages?.[0];
    if (!message) throw new Error('Invalid WhatsApp payload: missing messages[]');

    const contact    = value?.contacts?.[0];
    let textBody     = '';
    if (message.type === 'text') textBody = message.text?.body ?? '';
    else if (message.type === 'interactive')
      textBody = message.interactive?.button_reply?.title
              ?? message.interactive?.list_reply?.title ?? '';

    const media = this.extractMedia(message);

    return {
      id: message.id,
      channel: 'whatsapp',
      senderId: message.from,
      text: textBody,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      metadata: {
        tenantId: '',   // ← gateway lo sobreescribe
        senderName: contact?.profile?.name,
        displayPhoneNumber: value?.metadata?.display_phone_number,
        phoneNumberId: value?.metadata?.phone_number_id,
        messageType: message.type,
      },
      media: media.length > 0 ? media : undefined,
    };
  }

  extractThreadId(msg: GenericMessage): string {
    return msg.senderId; // teléfono
  }

  private extractMedia(message: any): NonNullable<GenericMessage['media']> {
    const media: NonNullable<GenericMessage['media']> = [];
    const types = ['image', 'audio', 'document', 'video', 'voice', 'sticker'];
    for (const t of types) {
      if (message.type === t && message[t]) {
        media.push({
          type: t,
          mimeType: message[t].mime_type ?? 'application/octet-stream',
          id: message[t].id,
        });
      }
    }
    return media;
  }
}
```

#### 3.4.2 `TelegramAdapter` (actualizado)

```typescript
// src/orchestrator/src/adapters/telegram.adapter.ts

import type { ChannelAdapter, GenericMessage } from './types.js';

export class TelegramAdapter implements ChannelAdapter {

  verifySignature(_rawBody: string, headers: Record<string, string | undefined>): boolean {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) return true;
    return headers['x-telegram-bot-api-secret-token'] === secret;
  }

  normalize(rawPayload: any): GenericMessage {
    const message = rawPayload.message
                 ?? rawPayload.edited_message
                 ?? rawPayload.callback_query?.message;
    if (!message) throw new Error('Invalid Telegram payload: missing message object');

    const textBody = rawPayload.callback_query?.data
                  ?? message.text ?? message.caption ?? '';
    const from     = message.from ?? rawPayload.callback_query?.from;
    const senderId = from?.id?.toString() ?? message.chat?.id?.toString();

    const media = this.extractMedia(message);

    return {
      id: message.message_id.toString(),
      channel: 'telegram',
      senderId,
      text: textBody,
      timestamp: new Date(message.date * 1000),
      metadata: {
        tenantId: '',   // ← gateway lo sobreescribe
        updateId: rawPayload.update_id,
        chatId: message.chat?.id?.toString(),
        chatType: message.chat?.type,
        senderUsername: from?.username,
        senderFirstName: from?.first_name,
        senderLastName: from?.last_name,
        isCallbackQuery: !!rawPayload.callback_query,
      },
      media: media.length > 0 ? media : undefined,
    };
  }

  extractThreadId(msg: GenericMessage): string {
    return msg.metadata.chatId ?? msg.senderId;
  }

  private extractMedia(message: any): NonNullable<GenericMessage['media']> {
    const media: NonNullable<GenericMessage['media']> = [];
    if (message.photo?.length) {
      const photo = message.photo[message.photo.length - 1];
      media.push({ type: 'photo', mimeType: 'image/jpeg', id: photo.file_id });
    }
    for (const t of ['document', 'voice', 'video', 'audio'] as const) {
      if (message[t]) {
        media.push({
          type: t,
          mimeType: message[t].mime_type ?? 'application/octet-stream',
          id: message[t].file_id,
        });
      }
    }
    return media;
  }
}
```

#### 3.4.3 `FormsAdapter` (nuevo)

```typescript
// src/orchestrator/src/adapters/forms.adapter.ts

import crypto from 'crypto';
import type { ChannelAdapter, GenericMessage } from './types.js';

/**
 * Payload esperado del webhook de formularios.
 * Compatible con Tally, Typeform (vía transform), y formularios custom.
 *
 * Contrato mínimo del payload:
 * {
 *   formId:    string,             // ID del formulario en el proveedor
 *   eventId?:  string,             // ID único de la submission
 *   provider:  'tally' | 'typeform' | 'jotform' | 'custom',
 *   respondent: {
 *     email?:  string,
 *     phone?:  string,
 *     name?:   string,
 *   },
 *   fields: Array<{ key: string; label: string; value: any }>,
 *   submittedAt?: string,          // ISO 8601
 *   signature?:   string,          // HMAC del proveedor
 * }
 */
export interface FormWebhookPayload {
  formId:       string;
  eventId?:     string;
  provider:     'tally' | 'typeform' | 'jotform' | 'custom';
  respondent:   { email?: string; phone?: string; name?: string };
  fields:       Array<{ key: string; label: string; value: any }>;
  submittedAt?: string;
  signature?:   string;
}

export class FormsAdapter implements ChannelAdapter {

  verifySignature(rawBody: string, headers: Record<string, string | undefined>): boolean {
    const secret = process.env.FORMS_WEBHOOK_SECRET;
    if (!secret) return true;
    // Soporte genérico: Tally envía en header, Typeform en body.signature
    const signature = headers['x-webhook-signature']
                   ?? headers['x-tally-signature'];
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  normalize(rawPayload: FormWebhookPayload): GenericMessage {
    const { formId, eventId, provider, respondent, fields, submittedAt } = rawPayload;

    if (!formId || !fields?.length) {
      throw new Error('Invalid Forms payload: missing formId or fields');
    }

    // Construir texto legible a partir de los campos del formulario
    const textBody = fields
      .map(f => `${f.label}: ${typeof f.value === 'object' ? JSON.stringify(f.value) : f.value}`)
      .join('\n');

    // Identificador del remitente: preferimos email > phone > 'anonymous-<eventId>'
    const senderId = respondent?.email
                  ?? respondent?.phone
                  ?? `anonymous-${eventId ?? crypto.randomUUID()}`;

    return {
      id: eventId ?? crypto.randomUUID(),
      channel: 'forms',
      senderId,
      text: textBody,
      timestamp: submittedAt ? new Date(submittedAt) : new Date(),
      metadata: {
        tenantId: '',           // ← gateway lo sobreescribe
        formId,
        provider,
        respondentName: respondent?.name,
        respondentEmail: respondent?.email,
        respondentPhone: respondent?.phone,
        fieldsRaw: fields,     // Conservar campos estructurados para nodos downstream
      },
    };
  }

  extractThreadId(msg: GenericMessage): string {
    // Agrupamos por email/phone para continuidad de conversación con el lead
    return msg.senderId;
  }
}
```

### 3.5 Ingestion Gateway — Middleware unificado

```typescript
// src/orchestrator/src/middleware/ingestion-gateway.ts

import type { Context, Next } from 'hono';
import { AdapterFactory } from '../adapters/factory.js';
import type { GenericMessage } from '../adapters/types.js';

/**
 * Middleware Hono que unifica la lógica de ingestión:
 * 1. Extrae x-tenant-id del header (inyectado por Mission Control).
 * 2. Resuelve el adaptador del canal vía AdapterFactory.
 * 3. Valida la firma del canal.
 * 4. Normaliza el payload → GenericMessage.
 * 5. Estampa tenantId en metadata.
 * 6. Inyecta genericMessage en el contexto Hono para el handler.
 */
export async function ingestionGateway(c: Context, next: Next) {
  const channel  = c.req.param('channel');
  const tenantId = c.req.header('x-tenant-id') ?? process.env.TENANT_ID;

  if (!tenantId) {
    console.warn(`[Gateway] Request sin tenantId para canal ${channel}`);
    return c.text('Bad Request: missing x-tenant-id', 400);
  }

  if (!channel) {
    return c.text('Bad Request: missing channel', 400);
  }

  let adapter;
  try {
    adapter = AdapterFactory.getAdapter(channel);
  } catch {
    return c.text(`Unsupported channel: ${channel}`, 400);
  }

  const rawBody = await c.req.text();

  // --- Verificación de firma por canal ---
  const headers: Record<string, string | undefined> = {};
  for (const key of ['x-hub-signature-256', 'x-telegram-bot-api-secret-token',
                      'x-webhook-signature', 'x-tally-signature']) {
    headers[key] = c.req.header(key);
  }

  if (!adapter.verifySignature(rawBody, headers)) {
    console.warn(`[Gateway] Firma inválida para canal ${channel}, tenant ${tenantId}`);
    return c.text('Forbidden', 403);
  }

  // --- Normalización ---
  let genericMsg: GenericMessage;
  try {
    const payload = JSON.parse(rawBody);
    genericMsg = adapter.normalize(payload);
  } catch (e: any) {
    console.warn(`[Gateway] Payload inválido para ${channel}: ${e.message}`);
    // Retornar 200 para canales que reintentan (Meta, Telegram)
    return c.text('OK', 200);
  }

  // --- Estampar tenantId (fuente de verdad: gateway, no adaptador) ---
  genericMsg.metadata.tenantId = tenantId;

  // Inyectar en contexto Hono para que el handler lo consuma
  c.set('genericMessage', genericMsg);
  c.set('tenantId', tenantId);
  c.set('threadId', adapter.extractThreadId(genericMsg));

  await next();
}
```

### 3.6 Handler unificado (reemplaza los 5 endpoints actuales)

```typescript
// src/orchestrator/src/routes/webhook.ts

import { Hono } from 'hono';
import { HumanMessage } from '@langchain/core/messages';
import { app as workflowApp } from '../graph.js';
import { acquireLock, releaseLock } from '../services/checkpointer.js';
import { FinOpsCallbackHandler } from '../callbacks/finops-callback.js';
import { sendL1Alert } from '../services/alert.js';
import { ingestionGateway } from '../middleware/ingestion-gateway.js';
import type { GenericMessage } from '../adapters/types.js';

const webhook = new Hono();

// GET para verificación de Meta (challenge/response)
webhook.get('/:channel', (c) => {
  const mode      = c.req.query('hub.mode');
  const token     = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return c.text(challenge || 'OK', 200);
  }
  return c.text('Forbidden', 403);
});

// POST unificado — el middleware ya validó, normalizó y estampó tenantId
webhook.post('/:channel', ingestionGateway, async (c) => {
  const genericMsg = c.get('genericMessage') as GenericMessage;
  const tenantId   = c.get('tenantId') as string;
  const threadId   = c.get('threadId') as string;

  // Fire-and-forget para retornar rápido al proveedor
  (async () => {
    try {
      const locked = await acquireLock(threadId);
      if (!locked) {
        console.log(`[Gateway] Thread ${threadId} locked, skipping`);
        return;
      }
      console.log(`[Gateway][${genericMsg.channel}] tenant=${tenantId} thread=${threadId}: ${genericMsg.text.slice(0, 80)}`);

      const finOps = new FinOpsCallbackHandler(tenantId, threadId);
      await workflowApp.invoke(
        { messages: [new HumanMessage(genericMsg.text)], genericMessage: genericMsg },
        { configurable: { thread_id: threadId }, callbacks: [finOps] },
      );
    } catch (error) {
      console.error(`[Gateway] Error invocando grafo (${genericMsg.channel}):`, error);
      await sendL1Alert(error, {
        tenantId,
        channel: genericMsg.channel,
        senderId: genericMsg.senderId,
        message: genericMsg.text || 'Unknown',
      });
    } finally {
      try { await releaseLock(threadId); } catch {}
    }
  })();

  // Formularios y Web pueden preferir 202; Meta y Telegram necesitan 200
  if (genericMsg.channel === 'web') {
    return c.json({ status: 'Processing', eventId: genericMsg.id }, 202);
  }
  return c.text('OK', 200);
});

export { webhook };
```

Montaje en `index.ts`:

```typescript
import { webhook } from './routes/webhook.js';
app.route('/api/webhook', webhook);
```

## 4. Invariante de seguridad: `tenantId` en `GenericMessage.metadata`

| Capa | Responsabilidad | Garantía |
|------|-----------------|----------|
| **Mission Control Proxy** | Extraer `tenantId` del path y ponerlo en `x-tenant-id` header | El orquestador siempre recibe el tenant |
| **Ingestion Gateway middleware** | Leer `x-tenant-id` (fallback `process.env.TENANT_ID`), rechazar si falta, estampar en `metadata.tenantId` | `GenericMessage.metadata.tenantId` nunca es `undefined` al invocar el grafo |
| **Adaptadores** | Poner `tenantId: ''` como placeholder; **nunca** asignar un valor real | Single source of truth = gateway |
| **`hydrateContextNode`** | Leer `state.genericMessage.metadata.tenantId` | Resolución de config per-tenant sin `process.env` |

> **Regla de oro:** El adaptador normaliza el payload del canal. El gateway estampa la identidad del tenant. Ninguno invade la responsabilidad del otro.

## 5. Migración y retrocompatibilidad

| Aspecto | Estrategia |
|---------|-----------|
| `GenericMessage.metadata` era `optional` | Se hace `required` con tipo `MessageMetadata`. Los adaptadores existentes (`email`, `web`) deben actualizar su `normalize()` para retornar `metadata: { tenantId: '', ... }` |
| `process.env.TENANT_ID` | Se mantiene como fallback en el middleware para instancias single-tenant (Cloud Run 1:1). El `hydrateContextNode` ya no necesita el fallback propio. |
| Endpoints actuales en `index.ts` | Se reemplazan por `app.route('/api/webhook', webhook)`. Ruta `/api/webhook` (POST raíz para Meta) se vuelve `/api/webhook/whatsapp` — el proxy ya envía a ese path. |
| `ChannelAdapter` interface | Se añaden `verifySignature()` y `extractThreadId()`. Los adaptadores existentes deben implementarlos (trivial). |

## 6. Pruebas

### 6.1 Unit tests (vitest)

| Test | Qué valida |
|------|-----------|
| `AdapterFactory.getAdapter('forms')` | Retorna `FormsAdapter` instance |
| `AdapterFactory.getAdapter('unknown')` | Throws |
| `AdapterFactory.register('sms', fn)` | Plugin puede registrar canal custom |
| `WhatsAppAdapter.normalize(validPayload)` | `metadata.tenantId === ''` (placeholder) |
| `TelegramAdapter.verifySignature(body, { 'x-telegram-bot-api-secret-token': 'bad' })` | `false` |
| `FormsAdapter.normalize(tallyPayload)` | `channel === 'forms'`, fields en text, senderId = email |
| `ingestionGateway` sin `x-tenant-id` | Retorna 400 |
| `ingestionGateway` con firma inválida | Retorna 403 |
| `ingestionGateway` happy path | `c.get('genericMessage').metadata.tenantId === 'tenant-123'` |

### 6.2 Integration test

```bash
# Simular proxy → orquestador con tenantId en header
curl -X POST http://localhost:3000/api/webhook/forms \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-abc-123" \
  -d '{
    "formId": "form_001",
    "eventId": "evt_001",
    "provider": "tally",
    "respondent": { "email": "lead@example.com", "name": "Juan" },
    "fields": [
      { "key": "interest", "label": "Interés", "value": "CRM Enterprise" },
      { "key": "company",  "label": "Empresa", "value": "Acme Corp" }
    ]
  }'
# Esperado: 200 OK, log muestra tenant=tenant-abc-123
```

---

## 7. WBS (Work Breakdown Structure)

### Fase 1 — Tipos y Factory (0.5 día)

| # | Tarea | Archivo | Estimación |
|---|-------|---------|------------|
| 1.1 | Extender `SupportedChannel` con `'forms'` | `adapters/types.ts` | 15 min |
| 1.2 | Añadir `MessageMetadata` interface con `tenantId: string` required | `adapters/types.ts` | 15 min |
| 1.3 | Añadir `verifySignature()` y `extractThreadId()` al interface `ChannelAdapter` | `adapters/types.ts` | 15 min |
| 1.4 | Migrar `AdapterFactory` a registry pattern | `adapters/factory.ts` | 30 min |
| 1.5 | Actualizar `EmailAdapter` y `WebAdapter` para cumplir nuevo contrato | `adapters/email.adapter.ts`, `web.adapter.ts` | 30 min |

### Fase 2 — Adaptadores (1 día)

| # | Tarea | Archivo | Estimación |
|---|-------|---------|------------|
| 2.1 | Actualizar `WhatsAppAdapter` con `verifySignature()`, `extractThreadId()`, `metadata.tenantId: ''` | `adapters/whatsapp.adapter.ts` | 45 min |
| 2.2 | Actualizar `TelegramAdapter` con `verifySignature()`, `extractThreadId()`, `metadata.tenantId: ''` | `adapters/telegram.adapter.ts` | 45 min |
| 2.3 | Implementar `FormsAdapter` completo | `adapters/forms.adapter.ts` | 1.5 hr |
| 2.4 | Unit tests para los 3 adaptadores | `adapters/__tests__/` | 1.5 hr |

### Fase 3 — Ingestion Gateway Middleware (0.5 día)

| # | Tarea | Archivo | Estimación |
|---|-------|---------|------------|
| 3.1 | Implementar `ingestionGateway` middleware | `middleware/ingestion-gateway.ts` | 1 hr |
| 3.2 | Implementar handler unificado `webhook.ts` | `routes/webhook.ts` | 1 hr |
| 3.3 | Unit tests del middleware (mock Hono context) | `middleware/__tests__/` | 1 hr |

### Fase 4 — Integración (0.5 día)

| # | Tarea | Archivo | Estimación |
|---|-------|---------|------------|
| 4.1 | Reemplazar endpoints en `index.ts` por `app.route('/api/webhook', webhook)` | `index.ts` | 30 min |
| 4.2 | Inyectar `x-tenant-id` en Mission Control proxy | `route.ts` (MC) | 15 min |
| 4.3 | Eliminar fallback `process.env.TENANT_ID` en `hydrateContextNode` (dejar solo `metadata.tenantId`) | `nodes/hydrate_context.ts` | 15 min |
| 4.4 | Integration test end-to-end (3 canales) | `tests/integration/` | 1.5 hr |

### Fase 5 — QA y Deploy (0.5 día)

| # | Tarea | Estimación |
|---|-------|------------|
| 5.1 | Test en staging con webhook real de Telegram | 1 hr |
| 5.2 | Test con Tally webhook hacia `/api/webhook/forms` | 30 min |
| 5.3 | Verificar WhatsApp Cloud API con nueva ruta `/api/webhook/whatsapp` | 30 min |
| 5.4 | Deploy a Cloud Run | 30 min |

---

**Total estimado: ~3 días de trabajo**

| Fase | Días |
|------|------|
| Tipos y Factory | 0.5 |
| Adaptadores | 1.0 |
| Gateway Middleware | 0.5 |
| Integración | 0.5 |
| QA y Deploy | 0.5 |

---

## 8. Decisiones de diseño

1. **`tenantId` inyectado por gateway, no por adaptador** — El adaptador no tiene visibilidad de la capa HTTP; recibe un payload crudo del canal. Mezclar responsabilidades haría que cada adaptador deba conocer headers HTTP.

2. **Registry pattern en `AdapterFactory`** — Permite a futuros canales (SMS, Instagram) registrarse sin modificar el archivo factory. Extensión sin modificación.

3. **`verifySignature` en el adaptador** — Cada canal tiene su propia estrategia de firma (HMAC-SHA256 para Meta, token para Telegram, HMAC-base64 para Tally). El adaptador es quien conoce el protocolo de su canal.

4. **Handler unificado** — Los 5 endpoints actuales comparten el 90% de su lógica (parse → normalize → lock → invoke → release). Unificarlos reduce ~200 líneas de código duplicado y garantiza comportamiento consistente.

5. **Fallback a `process.env.TENANT_ID`** — Se preserva para el caso single-tenant (1 instancia Cloud Run = 1 tenant) donde no hay proxy intermediario. El middleware prioriza el header.
