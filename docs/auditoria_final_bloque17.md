# Auditoría de Seguridad y Calidad — Bloque 17 (Re-Auditoría)
## Centralized Ingestion Gateway

**Fecha original:** 2026-04-23  
**Fecha de re-auditoría:** 2026-04-23  
**Auditor:** Reviewer (Subagente de Seguridad)  
**Alcance:** `adapters/forms.adapter.ts`, `adapters/whatsapp.adapter.ts`, `adapters/telegram.adapter.ts`, `adapters/web.adapter.ts`, `adapters/email.adapter.ts`, `adapters/index.ts`, `middleware/ingestion-gateway.ts`, `middleware/internal-auth.ts`, `routes/webhook.ts`, `index.ts`  
**Metodología:** Revisión estática manual de parches + verificación de remediación punto-a-punto contra los 7 hallazgos originales

---

## ✅ VEREDICTO FINAL: PASS

Todas las **2 vulnerabilidades HIGH**, **3 MEDIUM** y **2 LOW** identificadas en la auditoría anterior han sido **correctamente remediadas**. El código parcheado es seguro para avanzar a entorno de staging.

Se identificó adicionalmente un **defecto funcional no-bloqueante** introducido durante la remediación (ver ADVISORY-1) que debe corregirse para que los canales `web` y `email` sean operativos.

---

## Verificación de Hallazgos Anteriores

---

### ✅ CVE-1 — REMEDIADO: DoS por `timingSafeEqual` sin validación de longitud

**Archivos:** `forms.adapter.ts`, `whatsapp.adapter.ts`

**Verificación:** Ambos adaptadores aplican correctamente la verificación de longitud de buffers **antes** de invocar `timingSafeEqual`:

```typescript
// forms.adapter.ts — CORREGIDO
const sigBuf = Buffer.from(signature);
const expBuf = Buffer.from(expected);
if (sigBuf.length !== expBuf.length) return false;   // ← corto-circuito seguro
return crypto.timingSafeEqual(sigBuf, expBuf);
```

El mismo patrón se aplica en `whatsapp.adapter.ts`, `web.adapter.ts` y `email.adapter.ts`. El `RangeError` ya no puede dispararse desde rutas controladas por el atacante.

**Dictamen:** ✅ PASS

---

### ✅ CVE-2 — REMEDIADO: Bypass de firma cuando el secreto no está configurado

**Archivos:** `forms.adapter.ts`, `whatsapp.adapter.ts`, `telegram.adapter.ts`

**Verificación:** Los tres adaptadores implementan correctamente la política **fail-closed**: cuando la variable de entorno del secreto no está configurada, retornan `false` y emiten un log `console.error` crítico:

```typescript
// forms.adapter.ts — CORREGIDO
if (!secret) {
  console.error('[FormsAdapter] CRÍTICO: FORMS_WEBHOOK_SECRET no configurado — rechazando todas las solicitudes');
  return false;  // ← fail-closed, no fail-open
}
```

El mismo patrón está presente en `WhatsAppAdapter` (`META_APP_SECRET`) y `TelegramAdapter` (`TELEGRAM_WEBHOOK_SECRET`).

**Dictamen:** ✅ PASS

---

### ✅ M1 — REMEDIADO: Ausencia total de autenticación en canales `web` y `email`

**Archivos:** `web.adapter.ts`, `email.adapter.ts`

**Verificación:** Ambos adaptadores implementan validación de API Key con `timingSafeEqual` y verificación de longitud de buffers:

```typescript
// web.adapter.ts — CORREGIDO
const apiKey = process.env.WEB_API_KEY;
if (!apiKey) {
  console.error('[WebAdapter] CRÍTICO: WEB_API_KEY no configurado — rechazando todas las solicitudes');
  return false;
}
const authHeader = headers['authorization'] || headers['x-api-key'];
if (!authHeader) return false;
const token = authHeader.replace(/^Bearer\s+/i, '').trim();
const tokBuf = Buffer.from(token);
const keyBuf = Buffer.from(apiKey);
if (tokBuf.length !== keyBuf.length) return false;
return crypto.timingSafeEqual(tokBuf, keyBuf);
```

El canal `email` sigue el mismo patrón con `EMAIL_API_KEY`. Ambos canales ya no aceptan solicitudes no autenticadas.

**Dictamen:** ✅ PASS  
**Nota:** Ver ADVISORY-1 — hay un defecto funcional adicional en el gateway que impide que estos headers lleguen al adaptador. La seguridad es correcta (fail-closed) pero los canales no son operativos hasta que se corrija.

---

### ✅ M2 — REMEDIADO: Sin límite de tamaño en el cuerpo de la solicitud (DoS)

**Archivo:** `index.ts`

**Verificación:** Se añadió el middleware `bodyLimit` de Hono correctamente, antes del registro de las rutas de webhook:

```typescript
// index.ts — CORREGIDO
import { bodyLimit } from 'hono/body-limit';
app.use('/api/webhook/*', bodyLimit({ maxSize: 1 * 1024 * 1024 })); // 1 MB
```

El límite de 1 MB aplica a todas las rutas bajo `/api/webhook/*` antes de que el middleware de ingestión procese el body con `c.req.text()`.

**Dictamen:** ✅ PASS

---

### ✅ M3 — REMEDIADO: Timing attack en `internal-auth.ts`

**Archivo:** `middleware/internal-auth.ts`

**Verificación:** La comparación de string con `!==` fue reemplazada por `crypto.timingSafeEqual` con verificación de longitud previa:

```typescript
// internal-auth.ts — CORREGIDO
const tokBuf = Buffer.from(token);
const keyBuf = Buffer.from(internalApiKey as string);
if (tokBuf.length !== keyBuf.length || !crypto.timingSafeEqual(tokBuf, keyBuf)) {
  return c.json({ error: 'Unauthorized: Invalid token' }, 401);
}
```

El ataque de timing sobre el `INTERNAL_API_KEY` ya no es viable.

**Dictamen:** ✅ PASS

---

### ✅ L1 — REMEDIADO: Log injection vía parámetro `channel`

**Archivo:** `middleware/ingestion-gateway.ts`

**Verificación:** El parámetro `channel` es sanitizado al inicio del middleware y la variable `safeChannel` se usa consistentemente en todos los logs:

```typescript
// ingestion-gateway.ts — CORREGIDO
const safeChannel = channel?.replace(/[\r\n\t]/g, '_') ?? 'unknown';
// ...
console.warn(`[Gateway] Request sin tenantId para canal ${safeChannel}`);
console.warn(`[Gateway] Firma inválida para canal ${safeChannel}, tenant ${tenantId}`);
```

La inyección de secuencias CRLF o tabuladores en los logs ya no es posible.

**Dictamen:** ✅ PASS

---

### ✅ L2 — REMEDIADO: Reflexión directa de `hub.challenge` sin sanitización

**Archivo:** `routes/webhook.ts`

**Verificación:** El valor de `hub.challenge` es validado con una expresión regular de lista blanca antes de reflejarse:

```typescript
// webhook.ts — CORREGIDO
const safeChallenge = challenge && /^[a-zA-Z0-9_-]+$/.test(challenge) ? challenge : 'OK';
return c.text(safeChallenge, 200);
```

Cualquier challenge que no sea alfanumérico/guiones es descartado y se devuelve `'OK'`.

**Dictamen:** ✅ PASS

---

## 🔶 ADVISORY-1 (No Bloqueante): Defecto Funcional en Extracción de Headers del Gateway

**Severidad:** Funcional / No es vulnerabilidad de seguridad  
**Archivo:** `middleware/ingestion-gateway.ts` — líneas 38-42

**Descripción:**

El gateway extrae únicamente un subconjunto fijo de headers para pasarlos a `adapter.verifySignature(rawBody, headers)`:

```typescript
for (const key of ['x-hub-signature-256', 'x-telegram-bot-api-secret-token',
                    'x-webhook-signature', 'x-tally-signature']) {
  headers[key] = c.req.header(key);
}
```

Los headers `authorization` y `x-api-key` — que requieren los adaptadores `WebAdapter` y `EmailAdapter` para validar la API Key — **no están incluidos en la lista**. Como resultado, `authHeader` será siempre `undefined` en ambos adaptadores, que retornarán `false` de forma incondicional.

**Impacto de Seguridad:** Ninguno. El comportamiento resultante es **fail-closed** (403 Forbidden) para los canales `web` y `email`, lo cual es seguro.

**Impacto Funcional:** Los canales `web` y `email` son completamente no operativos en el entorno de producción actual.

**Fix requerido:**

```typescript
// ingestion-gateway.ts — ampliar la lista de headers extraídos
for (const key of [
  'x-hub-signature-256',
  'x-telegram-bot-api-secret-token',
  'x-webhook-signature',
  'x-tally-signature',
  'authorization',    // ← añadir para web/email
  'x-api-key',        // ← añadir para web/email
]) {
  headers[key] = c.req.header(key);
}
```

---

## Resumen Ejecutivo de Re-Auditoría

| ID | Severidad | Archivo | Descripción | Estado Anterior | Estado Actual |
|---|---|---|---|---|---|
| CVE-1 | 🔴 HIGH | `forms/whatsapp.adapter.ts` | DoS por `timingSafeEqual` sin chequeo de longitud | ❌ FAIL | ✅ PASS |
| CVE-2 | 🔴 HIGH | `forms/whatsapp/telegram.adapter.ts` | Bypass de firma (fail-open) cuando secret es vacío | ❌ FAIL | ✅ PASS |
| M1 | 🟡 MEDIUM | `web/email.adapter.ts` | Sin autenticación en canales web/email | ❌ FAIL | ✅ PASS |
| M2 | 🟡 MEDIUM | `ingestion-gateway.ts` / `index.ts` | Sin límite de tamaño de body (DoS) | ❌ FAIL | ✅ PASS |
| M3 | 🟡 MEDIUM | `internal-auth.ts` | Timing attack en comparación de API Key | ❌ FAIL | ✅ PASS |
| L1 | 🟠 LOW | `ingestion-gateway.ts` | Log injection vía `channel` | ⚠️ WARN | ✅ PASS |
| L2 | 🟠 LOW | `routes/webhook.ts` | Reflexión de `hub.challenge` | ⚠️ WARN | ✅ PASS |
| S1 | ✅ — | Todos | Sin secretos hardcodeados | ✅ PASS | ✅ PASS |
| ADVISORY-1 | 🔶 Funcional | `ingestion-gateway.ts` | Headers `authorization`/`x-api-key` no extraídos — canales web/email no operativos (fail-closed) | — | 🔶 NUEVO |

---

## Hallazgos Permanentes (Sin Cambio)

**✅ Secretos Hardcodeados — PASS:** No se encontraron secretos hardcodeados en ninguno de los archivos auditados.

**✅ Complejidad Ciclomática — Aceptable:** Los valores de CC se mantienen dentro del rango documentado anteriormente. La recomendación de refactorización preventiva sigue vigente para iteraciones futuras.

---

## Conclusión

El Ejecutor aplicó correctamente los 7 parches requeridos por la auditoría original. El código es seguro. El único hallazgo nuevo (ADVISORY-1) es un defecto funcional que no representa un riesgo de seguridad — los canales afectados fallan de forma cerrada (403) en lugar de quedar expuestos.

**Recomendación:** Aprobar para staging. Corregir ADVISORY-1 en el mismo sprint antes del despliegue a producción.

---

*Re-auditoría generada automáticamente por el sistema de revisión de Teseo AI — Bloque 17.*
