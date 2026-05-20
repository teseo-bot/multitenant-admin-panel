# RFC-051: Bloque 18 — Soporte Multi-Tenant Completo (Eliminación de Fallbacks `process.env.TENANT_ID`)

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| **ID**         | RFC-051                                        |
| **Estado**     | Borrador                                       |
| **Fecha**      | 2026-04-23                                     |
| **Autor**      | Builder (Arquitecto Staff)                     |
| **Dominio**    | Orquestador LangGraph · Seguridad Multi-Tenant |
| **Bloques**    | Bloque 18                                      |
| **Precedentes**| ADR-097 (Single-Tenant SaaS), ADR-139 (Multi-Tenant Onboarding), ADR-006 (Ingestion Gateway) |

---

## 1. Contexto y Problema

El ecosistema CRM-Agéntico fue concebido originalmente como single-tenant: un único `TENANT_ID` vivía en `process.env` y todos los componentes lo consumían de ahí. Con la evolución hacia un modelo Hub & Spoke (ADR-139) y la posibilidad de servir múltiples inquilinos desde una misma instancia del orquestador, **los fallbacks a `process.env.TENANT_ID` se convierten en una vulnerabilidad de aislamiento crítica (cross-tenant data bleed)**.

### 1.1 Inventario de Violaciones Actuales

Se identifican **tres puntos exactos** donde persiste la dependencia a variables de entorno globales:

| # | Archivo | Repositorio | Línea | Código Violatorio | Severidad |
|---|---------|-------------|-------|--------------------|-----------|
| V1 | `src/services/webhook_dispatcher.ts` | `crm-agentico-orchestrator` | L6 | `const tenantId = process.env.TENANT_ID` | **CRÍTICA** — Despacha eventos al Tenant OS con un tenant estático; en un entorno multi-tenant, todos los eventos se atribuyen al mismo inquilino. |
| V2 | `src/orchestrator/src/middleware/ingestion-gateway.ts` | `Teseo-AI-CRM` | L17 | `c.req.header('x-tenant-id') ?? process.env.TENANT_ID` | **ALTA** — El operador `??` hace que cualquier request sin header `x-tenant-id` herede silenciosamente la variable de entorno, en lugar de fallar explícitamente. |
| V3 | `src/orchestrator/src/nodes/gatekeeper.ts` | `Teseo-AI-CRM` | L27 | `state.genericMessage?.metadata?.tenantId \|\| process.env.TENANT_ID` | **ALTA** — El gatekeeper usa un fallback global para despachar jobs de memoria (`[LEARN]`), lo que podría inyectar contexto de aprendizaje en el tenant equivocado. |

### 1.2 Brecha en la Propagación del Estado

Además de los fallbacks explícitos, existe una **brecha de propagación** en el flujo de invocación del grafo:

```
webhook.ts → workflowApp.invoke({
  messages: [...],
  genericMessage: genericMsg    // ← tenantId vive aquí en metadata
  // ⚠️ NO se inyecta tenant_id a nivel raíz del estado
})
```

El campo `tenant_id` del `GraphState` solo se puebla más adelante en `hydrate_context.ts` (extrayéndolo de `genericMessage.metadata.tenantId`). Esto significa que **cualquier nodo que se ejecute antes de `hydrateContextNode`** y que necesite `tenant_id` obtendrá `null`.

El nodo `gatekeeper` se ejecuta **antes** de `hydrate_context` en el grafo, lo cual explica por qué necesita el fallback a `process.env.TENANT_ID`.

### 1.3 Problema del `webhook_dispatcher.ts` (Orchestrator Legado)

El archivo `webhook_dispatcher.ts` en `crm-agentico-orchestrator` recibe un `GraphStateType` como argumento, **pero ignora `result.tenant_id`** y lee directamente de `process.env`. Esto es un vestigio del modelo single-tenant que rompe completamente el aislamiento en contextos compartidos.

---

## 2. Estrategia Arquitectónica

### 2.1 Principio Rector: Zero-Trust Tenant Resolution

> **Regla:** Ningún componente del sistema debe resolver `tenant_id` desde variables de entorno. El identificador del inquilino SIEMPRE debe provenir de la cadena de confianza: `Header HTTP → Gateway → GenericMessage.metadata → GraphState.tenant_id → Nodos`.

Si un `tenant_id` no puede resolverse desde la cadena de confianza, la operación **DEBE fallar ruidosamente** (HTTP 400/401 o excepción en el grafo), no degradarse silenciosamente.

### 2.2 Diagrama de Flujo Propuesto (Cadena de Confianza)

```
┌──────────────┐    x-tenant-id     ┌────────────────────┐
│ Mission Ctrl  │ ──────────────────→│ ingestion-gateway  │
│ / API Client  │   (Header HTTP)    │    (Middleware)     │
└──────────────┘                     └────────┬───────────┘
                                              │
                                     Validación ESTRICTA:
                                     ¿Header presente?
                                              │
                                     NO → HTTP 400 (Reject)
                                     SÍ ↓
                                              │
                              ┌───────────────┴───────────────┐
                              │  genericMsg.metadata.tenantId  │
                              │  c.set('tenantId', tenantId)   │
                              └───────────────┬───────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │       webhook handler          │
                              │  workflowApp.invoke({          │
                              │    messages: [...],            │
                              │    genericMessage: genericMsg, │
                              │    tenant_id: tenantId  ← NEW  │
                              │  })                            │
                              └───────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
              ┌─────┴─────┐           ┌───────┴───────┐         ┌──────┴──────┐
              │ Gatekeeper │           │ HydrateContext│         │    RAG      │
              │ (usa       │           │ (valida       │         │ (usa        │
              │ state.     │           │ state.        │         │ state.      │
              │ tenant_id) │           │ tenant_id)    │         │ tenant_id)  │
              └────────────┘           └───────────────┘         └─────────────┘
```

### 2.3 Cambios por Componente

#### A. `ingestion-gateway.ts` — Validación Estricta (Eliminar V2)

**Estado actual:**
```typescript
const tenantId = c.req.header('x-tenant-id') ?? process.env.TENANT_ID;
```

**Estado objetivo:**
```typescript
const tenantId = c.req.header('x-tenant-id');

if (!tenantId) {
  return c.text('Bad Request: missing x-tenant-id header', 400);
}
```

**Razonamiento:** El gateway es el **punto de entrada único** y la **fuente de verdad** para la identidad del inquilino. Si Mission Control o el API client no proporciona el header, la solicitud DEBE rechazarse. No existe un "tenant por defecto" válido en un sistema multi-tenant.

**Código HTTP de rechazo:** `400 Bad Request` (no `401 Unauthorized`) porque la ausencia del header es un error del cliente, no un problema de autenticación. El header ya debería haber sido inyectado por el proxy/load-balancer de Mission Control.

> **Nota para entornos de desarrollo local:** Si se necesita un tenant por defecto durante desarrollo, debe configurarse en el proxy/load-balancer (ej. un middleware Hono de desarrollo condicional), NUNCA en el gateway de producción.

#### B. `gatekeeper.ts` — Leer de `state.tenant_id` (Eliminar V3)

**Estado actual:**
```typescript
const tenantId = state.genericMessage?.metadata?.tenantId || process.env.TENANT_ID;
```

**Estado objetivo:**
```typescript
const tenantId = state.tenant_id;

if (!tenantId) {
  console.error("[Gatekeeper] CRITICAL: tenant_id ausente en GraphState. Abortando [LEARN].");
  return {
    routeDestination: "IGNORE",
    currentRoute: "__end__",
    messages: [new AIMessage("❌ Error interno: no se pudo identificar el inquilino.")]
  };
}
```

**Razonamiento:** Con la inyección de `tenant_id` en el estado raíz desde `webhook.ts` (ver sección C), el gatekeeper ya no necesita buscar en `genericMessage.metadata` ni en variables de entorno. El campo `state.tenant_id` es la fuente canónica.

#### C. `webhook.ts` (Handler) — Inyectar `tenant_id` en el estado inicial

**Estado actual:**
```typescript
await workflowApp.invoke(
  { messages: [new HumanMessage(genericMsg.text)], genericMessage: genericMsg },
  { configurable: { thread_id: threadId }, callbacks: [finOps] },
);
```

**Estado objetivo:**
```typescript
await workflowApp.invoke(
  {
    messages: [new HumanMessage(genericMsg.text)],
    genericMessage: genericMsg,
    tenant_id: tenantId,        // ← Inyección explícita en estado raíz
  },
  { configurable: { thread_id: threadId }, callbacks: [finOps] },
);
```

**Razonamiento:** Garantiza que `state.tenant_id` esté disponible desde el **primer nodo** del grafo (incluyendo `gatekeeper`), eliminando la dependencia temporal de `hydrate_context`.

#### D. `webhook_dispatcher.ts` — Leer de `GraphStateType` (Eliminar V1)

**Estado actual:**
```typescript
const tenantId = process.env.TENANT_ID;
const campaignId = process.env.CAMPAIGN_ID;
```

**Estado objetivo:**
```typescript
const tenantId = result.tenant_id;
const campaignId = result.campaignId;

if (!tenantId || !campaignId) {
  console.error('[Webhook Dispatcher] ABORT: tenant_id o campaignId no disponibles en GraphState.');
  return;
}
```

**Razonamiento:** El `GraphStateType` de `crm-agentico-orchestrator` ya declara `tenant_id` en su definición de estado. El dispatcher debe consumirlo del resultado del grafo, no de variables globales. Lo mismo aplica para `campaignId`, que ya existe como campo en el `GraphState` de Teseo-AI-CRM.

> **Nota:** El `GraphState` de `crm-agentico-orchestrator` actualmente **NO tiene** un campo `campaignId`. Si este repositorio necesita despachar eventos por campaña, debe agregarse el campo al estado o recibirse como parámetro de la función `dispatchEventsFromResult`.

#### E. `hydrate_context.ts` — Alineación (sin cambio funcional, validación defensiva)

El nodo `hydrateContextNode` actualmente extrae `tenantId` de `genericMessage.metadata.tenantId` y lo escribe en `state.tenant_id`. Con la inyección directa en `webhook.ts`, este nodo recibirá `state.tenant_id` ya poblado.

**Ajuste recomendado:** Agregar una aserción defensiva de consistencia:

```typescript
const tenantIdFromState = state.tenant_id;
const tenantIdFromMeta  = state.genericMessage?.metadata?.tenantId;

if (tenantIdFromState && tenantIdFromMeta && tenantIdFromState !== tenantIdFromMeta) {
  console.error(`[Hydrate] INCONSISTENCIA: state.tenant_id=${tenantIdFromState} ≠ metadata.tenantId=${tenantIdFromMeta}`);
  throw new Error("Tenant ID mismatch between state and metadata. Potential injection attack.");
}

const tenantId = tenantIdFromState || tenantIdFromMeta;
```

---

## 3. Normalización del Contrato `GraphState`

### 3.1 Estado Actual — Dos Repositorios, Dos Estados

| Campo | `Teseo-AI-CRM` (`state.ts`) | `crm-agentico-orchestrator` (`state.ts`) |
|-------|---------------------------|----------------------------------------|
| `tenant_id` | ✅ Presente (`string \| null`) | ✅ Presente (`string \| null`) |
| `campaignId` | ✅ Presente (`string \| null`) | ❌ Ausente |
| `tenantConfig` | ✅ Presente (`Record<string, any>`) | ❌ Ausente |
| `genericMessage` | ✅ Presente (`GenericMessage \| null`) | ✅ Presente (`GenericMessage \| null`) |
| `routeDestination` | ✅ Presente | ❌ Ausente |

### 3.2 Propagación de `tenant_id` — Flujo Completo por Nodo

| Nodo | Lee `tenant_id` de | Estado actual | Estado objetivo |
|------|--------------------|---------------|-----------------|
| `gatekeeper` | `genericMessage.metadata` + `process.env` fallback | ⚠️ Violación V3 | `state.tenant_id` (directo) |
| `hydrate_context` | `genericMessage.metadata.tenantId` | ✅ Correcto (escribe `state.tenant_id`) | ✅ + validación de consistencia |
| `retrieval_node` (RAG) | `state.tenant_id` | ✅ Correcto (throw si null) | Sin cambios |
| `investigador` | `state.tenant_id` | ✅ Correcto (L98: `ICPVectorizer.getCentroid(state.tenant_id)`) | Sin cambios |
| `webhook_dispatcher` | `process.env.TENANT_ID` | ⚠️ Violación V1 | `result.tenant_id` (del estado) |

### 3.3 Contrato Mínimo Requerido para Multi-Tenant

Todo nodo que acceda a datos específicos de un inquilino (base de datos, vectores, configuración, eventos) **DEBE**:

1. Leer `state.tenant_id` como fuente primaria y única.
2. Validar que no sea `null`, `undefined` ni cadena vacía antes de proceder.
3. Si la validación falla: lanzar un error explícito o retornar un estado terminal (`__end__`).
4. **NUNCA** recurrir a `process.env.TENANT_ID` como fallback.

---

## 4. Consideraciones de Seguridad

### 4.1 Cross-Tenant Data Bleed (Riesgo Eliminado)

Con los fallbacks actuales, si un request llega sin header `x-tenant-id`:
- **Hoy:** Se usa `process.env.TENANT_ID` → el request se procesa como si perteneciera al tenant configurado en la variable de entorno → **data bleed**.
- **Después:** Se rechaza con HTTP 400 → **fail-safe**.

### 4.2 Memory Injection via `[LEARN]` (Riesgo Mitigado)

El comando `[LEARN]` en el gatekeeper permite a un usuario inyectar contexto en la base de conocimiento. Con el fallback actual, un usuario de un tenant podría (en teoría) inyectar memorias en el tenant equivocado si `genericMessage.metadata.tenantId` falla en resolverse.

### 4.3 Entornos de Desarrollo

Para no romper flujos de desarrollo local donde no existe un Mission Control inyectando headers, se recomienda:
- Crear un middleware condicional `devTenantInjector` que **solo se active** cuando `NODE_ENV === 'development'`.
- Este middleware inyecta `x-tenant-id` desde `process.env.DEV_TENANT_ID` (nota: variable distinta, con prefijo `DEV_`).
- En producción, este middleware **no se registra**.

---

## 5. Work Breakdown Structure (WBS)

### Fase 1: Gateway Estricto (Prioridad: CRÍTICA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 1.1 | Eliminar fallback `?? process.env.TENANT_ID` del middleware de ingestión | `src/orchestrator/src/middleware/ingestion-gateway.ts` L17 | `Teseo-AI-CRM` | La línea `const tenantId = c.req.header('x-tenant-id') ?? process.env.TENANT_ID` se reemplaza por `const tenantId = c.req.header('x-tenant-id')`. El bloque `if (!tenantId)` existente en L19-22 ya retorna HTTP 400, así que solo hay que eliminar el operador `??` y su fallback. |
| 1.2 | (Opcional) Crear middleware de desarrollo `devTenantInjector` | `src/orchestrator/src/middleware/dev-tenant-injector.ts` (nuevo) | `Teseo-AI-CRM` | Middleware que solo se registra si `NODE_ENV === 'development'` y que inyecta `x-tenant-id` desde `process.env.DEV_TENANT_ID` si el header no está presente. Se registra ANTES de `ingestionGateway` en la cadena de middlewares del archivo de rutas. |
| 1.3 | Actualizar tests del gateway | Tests existentes del middleware | `Teseo-AI-CRM` | Agregar caso de prueba: request sin header `x-tenant-id` y sin variable de entorno → HTTP 400. Verificar que no se acepta un tenant vacío. |

### Fase 2: Inyección Explícita en el Estado del Grafo (Prioridad: ALTA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 2.1 | Inyectar `tenant_id` en el estado inicial al invocar el grafo | `src/orchestrator/src/routes/webhook.ts` L47-48 | `Teseo-AI-CRM` | El objeto pasado a `workflowApp.invoke()` incluye `tenant_id: tenantId` junto con `messages` y `genericMessage`. |
| 2.2 | Agregar validación de consistencia en `hydrate_context.ts` | `src/orchestrator/src/nodes/hydrate_context.ts` | `Teseo-AI-CRM` | Si `state.tenant_id` y `genericMessage.metadata.tenantId` difieren, lanzar error. Si `state.tenant_id` ya existe, usarlo como fuente primaria en lugar de re-extraerlo de metadata. |

### Fase 3: Eliminación de Fallback en Gatekeeper (Prioridad: ALTA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 3.1 | Reemplazar resolución de tenant en bloque `[LEARN]` | `src/orchestrator/src/nodes/gatekeeper.ts` L27 | `Teseo-AI-CRM` | La línea `state.genericMessage?.metadata?.tenantId \|\| process.env.TENANT_ID` se reemplaza por `state.tenant_id`. Si `state.tenant_id` es `null`, el bloque `[LEARN]` retorna un mensaje de error al usuario y aborta con `routeDestination: "IGNORE"`. |
| 3.2 | Actualizar test del gatekeeper | `src/orchestrator/src/nodes/gatekeeper.test.ts` | `Teseo-AI-CRM` | Verificar que el caso de prueba existente (L68) sigue pasando. Agregar caso: estado sin `tenant_id` + mensaje `[LEARN]` → retorna error, no invoca `dispatchMemoryJob`. |

### Fase 4: Corrección del Webhook Dispatcher (Prioridad: ALTA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 4.1 | Leer `tenant_id` y `campaignId` del resultado del grafo en lugar de `process.env` | `src/services/webhook_dispatcher.ts` L6-7 | `crm-agentico-orchestrator` | Las líneas `const tenantId = process.env.TENANT_ID` y `const campaignId = process.env.CAMPAIGN_ID` se reemplazan por `const tenantId = result.tenant_id` y `const campaignId = result.campaignId`. |
| 4.2 | Evaluar si `campaignId` debe agregarse al `GraphState` de `crm-agentico-orchestrator` | `src/state.ts` | `crm-agentico-orchestrator` | Si el repositorio legado necesita `campaignId`, agregar el campo `Annotation<string \| null>` al estado. Si no (porque el dispatcher se mueve a Teseo-AI-CRM), documentar la decisión. |
| 4.3 | Eliminar referencias a `TENANT_ID` y `CAMPAIGN_ID` como variables de entorno requeridas | `.env.example`, documentación | `crm-agentico-orchestrator` | Las variables `TENANT_ID` y `CAMPAIGN_ID` se eliminan de `.env.example` o se marcan como `DEPRECATED`. |

### Fase 5: Auditoría de Grep Final (Prioridad: MEDIA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 5.1 | Ejecutar `grep -rn "process.env.TENANT_ID"` en ambos repositorios | Global | Ambos | El grep retorna **cero resultados** (excluyendo archivos de documentación y el middleware `devTenantInjector`). |
| 5.2 | Ejecutar `grep -rn "process.env.CAMPAIGN_ID"` en ambos repositorios | Global | Ambos | El grep retorna **cero resultados** (excluyendo documentación). |
| 5.3 | Revisar cualquier uso de `?? process.env` o `\|\| process.env` con patrones de tenant/campaign | Global | Ambos | Cero instancias de fallback a variables de entorno para identificadores de inquilino. |

### Fase 6: Documentación y Cierre (Prioridad: BAJA)

| # | Tarea | Archivo | Repo | Criterio de Aceptación |
|---|-------|---------|------|------------------------|
| 6.1 | Actualizar `ARCHITECTURE_INDEX.md` con referencia a este RFC | `docs/ARCHITECTURE_INDEX.md` | `Teseo-AI-CRM` | Entrada del Bloque 18 documentada. |
| 6.2 | Crear ADR de cierre del Bloque 18 | `docs/ADR-XXX-Bloque18-MultiTenant-Closure.md` | `Teseo-AI-CRM` | Documento post-mortem con evidencia de los grep limpios y tests pasando. |

---

## 6. Orden de Ejecución y Dependencias

```
Fase 1 (Gateway)
    │
    ├──→ Fase 2 (Inyección en webhook.ts)  ← depende de Fase 1
    │         │
    │         ├──→ Fase 3 (Gatekeeper)     ← depende de Fase 2
    │         │
    │         └──→ Fase 4 (Dispatcher)     ← independiente de Fase 3
    │
    └──→ Fase 5 (Auditoría grep)           ← después de Fases 3 y 4
              │
              └──→ Fase 6 (Documentación)
```

**Estimación:** ~2-3 horas de implementación neta (las modificaciones son quirúrgicas, no refactorizaciones masivas).

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Tests de integración fallan porque no se inyecta `x-tenant-id` en los mocks | Alta | Medio | Fase 1.3 y 3.2 cubren la actualización de tests. Buscar todos los tests que usan `supertest` o similar y agregar el header. |
| El repositorio `crm-agentico-orchestrator` no tiene `campaignId` en su `GraphState` | Confirmado | Medio | Fase 4.2: Agregar el campo o recibir `campaignId` como parámetro de `dispatchEventsFromResult`. |
| Despliegue en producción rompe requests existentes que no envían `x-tenant-id` | Baja (Mission Control ya inyecta el header) | Alto | Verificar en logs de producción que el 100% de los requests tienen el header antes de eliminar el fallback. El middleware `devTenantInjector` cubre desarrollo local. |

---

## 8. Criterios de Aceptación Globales

- [ ] `grep -rn "process.env.TENANT_ID" src/` retorna **0 resultados** en ambos repositorios (excluyendo `dev-tenant-injector.ts`).
- [ ] `grep -rn "process.env.CAMPAIGN_ID" src/` retorna **0 resultados** en ambos repositorios.
- [ ] Un request POST a `/:channel` **sin** header `x-tenant-id` retorna HTTP 400.
- [ ] Un request POST a `/:channel` **con** header `x-tenant-id` se procesa correctamente y `state.tenant_id` está disponible desde el primer nodo.
- [ ] El nodo `gatekeeper` con un comando `[LEARN]` y `state.tenant_id = null` retorna un error amigable, NO invoca `dispatchMemoryJob`.
- [ ] El `webhook_dispatcher` despacha eventos usando `result.tenant_id`, no `process.env.TENANT_ID`.
- [ ] Todos los tests existentes pasan (con headers actualizados donde corresponda).
- [ ] El nodo `retrieval_node` (RAG) y el nodo `investigador` siguen funcionando sin cambios (ya consumen `state.tenant_id` correctamente).

---

## Apéndice A: Referencias de Archivos

| Archivo | Ruta Completa |
|---------|---------------|
| `webhook_dispatcher.ts` | `~/projects/crm-agentico-orchestrator/src/services/webhook_dispatcher.ts` |
| `ingestion-gateway.ts` | `~/projects/Teseo-AI-CRM/src/orchestrator/src/middleware/ingestion-gateway.ts` |
| `gatekeeper.ts` | `~/projects/Teseo-AI-CRM/src/orchestrator/src/nodes/gatekeeper.ts` |
| `webhook.ts` (handler) | `~/projects/Teseo-AI-CRM/src/orchestrator/src/routes/webhook.ts` |
| `hydrate_context.ts` | `~/projects/Teseo-AI-CRM/src/orchestrator/src/nodes/hydrate_context.ts` |
| `state.ts` (Teseo-AI-CRM) | `~/projects/Teseo-AI-CRM/src/orchestrator/src/state.ts` |
| `state.ts` (orchestrator) | `~/projects/crm-agentico-orchestrator/src/state.ts` |
| `retrieval_node.ts` | `~/projects/Teseo-AI-CRM/src/orchestrator/src/nodes/retrieval_node.ts` |
| `investigador.ts` | `~/projects/Teseo-AI-CRM/src/orchestrator/src/nodes/investigador.ts` |
