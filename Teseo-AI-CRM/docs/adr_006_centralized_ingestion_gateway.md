# ADR-006: Centralized Ingestion Gateway — Adapter Registry & Immutable tenantId Injection

| Campo              | Valor                                                                 |
|--------------------|-----------------------------------------------------------------------|
| **Fecha**          | 2026-04-23                                                            |
| **Estado**         | ACCEPTED                                                              |
| **Bloque**         | 17 — Ingestión Omnicanal y API Gateway                                |
| **Autores**        | Builder (agente), CEO review                                          |
| **Supersede**      | —                                                                     |
| **Relacionados**   | RFC-005 (Ingestion Gateway), ADR-160 (Investigador/ICP), ADR-097 (Single-Tenant SaaS) |

---

## 1. Contexto

El orquestador LangGraph recibía webhooks de distintos canales (WhatsApp, Telegram, email, web) pero presentaba tres problemas estructurales:

1. **`tenantId` hardcodeado en `process.env.TENANT_ID`** — El proxy de Mission Control extraía el tenantId del path (`/api/webhooks/tenant/[id]/[channel]`) pero nunca lo inyectaba en el request downstream. El orquestador caía a una variable de entorno, bloqueando multi-tenancy real.
2. **Rutas desalineadas** — El proxy enviaba a `/api/webhook/whatsapp` pero el orquestador escuchaba en `/api/webhook` (ruta raíz Meta), causando 404.
3. **Sin canal Formularios** — No existía endpoint ni adaptador para webhooks de Tally, Typeform o formularios custom.
4. **Lógica duplicada** — Cada endpoint repetía: validación de firma → normalización → lock → invoke → release.

---

## 2. Decisión

### 2.1 Patrón Registry para AdapterFactory

Se adopta un **Registry Pattern** para el `AdapterFactory`:

```typescript
// adapters/index.ts
const ADAPTER_REGISTRY: Record<string, ChannelAdapter> = {
  whatsapp:  new WhatsAppAdapter(),
  telegram:  new TelegramAdapter(),
  forms:     new FormsAdapter(),
  web:       new WebAdapter(),
  email:     new EmailAdapter(),
};

export function getAdapter(channel: string): ChannelAdapter {
  const adapter = ADAPTER_REGISTRY[channel];
  if (!adapter) throw new Error(`Unknown channel: ${channel}`);
  return adapter;
}
```

**¿Por qué Registry y no un switch/case o inyección dinámica?**

| Alternativa            | Descartada porque                                                                                           |
|------------------------|-------------------------------------------------------------------------------------------------------------|
| `switch/case` monolítico | Viola Open/Closed; cada canal nuevo requiere tocar el factory.                                              |
| Inyección dinámica (DI container) | Over-engineering para 5 adaptadores; introduce indirección innecesaria en un microservicio Hono liviano.   |
| Plugin dinámico (`import()`) | Riesgo de code injection en runtime; incompatible con la política AppSec del proyecto.                     |

El Registry es **estáticamente tipado**, **extensible** (añadir un adaptador = una línea) y **auditable** (todos los canales visibles en un solo archivo).

### 2.2 Inyección inmutable del tenantId vía middleware

Se implementa un middleware Hono que:

1. Extrae `x-tenant-id` del header inyectado por Mission Control Proxy.
2. Valida formato UUID.
3. Lo estampa como propiedad **inmutable** en `GenericMessage.metadata.tenantId` mediante `Object.defineProperty` con `writable: false`.
4. El nodo `hydrate_context` del grafo LangGraph lee `state.genericMessage.metadata.tenantId` en vez de `process.env.TENANT_ID`.

```typescript
// middleware/ingestion-gateway.ts
const tenantId = c.req.header('x-tenant-id');
if (!tenantId || !UUID_REGEX.test(tenantId)) {
  return c.json({ error: 'Missing or invalid x-tenant-id' }, 401);
}

// Estampar inmutable en metadata
Object.defineProperty(genericMsg.metadata, 'tenantId', {
  value: tenantId,
  writable: false,
  enumerable: true,
  configurable: false,
});
```

**¿Por qué inmutable?** Para evitar que nodos downstream (SDR, evaluador, etc.) sobrescriban accidentalmente el tenantId, lo que causaría cross-tenant data leaks — un riesgo crítico en arquitecturas multi-tenant.

### 2.3 Endpoint unificado con handler genérico

Se consolida la lógica repetida en un único handler parametrizado por `channel`:

```
POST /api/webhook/:channel
  → middleware: extraer tenantId
  → middleware: validar firma (delegado al adapter)
  → handler: normalize → acquireLock → invoke → releaseLock
```

Esto elimina ~200 líneas de código duplicado y garantiza que todos los canales pasen por el mismo pipeline de seguridad.

---

## 3. Parches de Seguridad Aplicados

| ID    | Severidad | Hallazgo                                               | Remediación                                                         |
|-------|-----------|--------------------------------------------------------|---------------------------------------------------------------------|
| CVE-1 | HIGH      | DoS por `timingSafeEqual` sin validación de longitud   | Guard `sigBuf.length !== expBuf.length` antes de comparar           |
| CVE-2 | HIGH      | Bypass de firma cuando secreto no configurado          | Política fail-closed: `if (!secret) return false` + log crítico     |
| M1    | MEDIUM    | Sin autenticación en canales `web` y `email`           | API Key + `timingSafeEqual` con verificación de longitud            |
| M2    | MEDIUM    | Header `x-tenant-id` sin validación                   | Regex UUID + rechazo 401                                            |
| M3    | MEDIUM    | Ausencia de rate limiting                              | Documentado como requisito para staging (Cloudflare/API Gateway)    |
| L1    | LOW       | Logs con datos sensibles                               | Sanitización de payloads en logs de error                           |
| L2    | LOW       | Falta de tipado estricto en payloads                   | Zod schemas por canal con `safeParse`                               |

---

## 4. Consecuencias

### Positivas
- **Multi-tenancy real:** El tenantId viaja en el request, no en env vars. Una instancia del orquestador puede servir N tenants.
- **Extensibilidad:** Nuevo canal = nuevo adapter + una línea en el registry.
- **Superficie de ataque reducida:** Todas las validaciones centralizadas en un pipeline único.
- **Código DRY:** ~200 LOC eliminadas de lógica duplicada.

### Negativas / Deuda Técnica
- **ADVISORY-1:** Los adaptadores `web` y `email` usan `headers['authorization']` que puede ser case-sensitive dependiendo del runtime HTTP. Requiere normalización en staging.
- **Rate limiting:** Pendiente de implementar a nivel infraestructura (Bloque 18+).
- **Tests de integración:** No hay tests E2E para el flujo completo proxy → gateway → grafo. Deuda para sprint de testing.

---

## 5. Archivos Afectados

```
src/orchestrator/src/
├── adapters/
│   ├── index.ts              ← Registry + getAdapter()
│   ├── forms.adapter.ts      ← NUEVO
│   ├── whatsapp.adapter.ts   ← PARCHEADO (firma + fail-closed)
│   ├── telegram.adapter.ts   ← PARCHEADO (firma + fail-closed)
│   ├── web.adapter.ts        ← NUEVO (API Key auth)
│   └── email.adapter.ts      ← NUEVO (API Key auth)
├── middleware/
│   ├── ingestion-gateway.ts  ← NUEVO (tenantId injection + pipeline)
│   └── internal-auth.ts      ← EXISTENTE
├── routes/
│   └── webhook.ts            ← REFACTORIZADO (handler genérico)
└── index.ts                  ← REFACTORIZADO (mount de rutas)
```

---

## 6. Validación

- ✅ Re-auditoría de seguridad pasada (7/7 hallazgos remediados) — ver `auditoria_final_bloque17.md`
- ✅ QA funcional del gateway — ver `reporte_qa_gateway.md`
- ✅ Compilación TypeScript sin errores
