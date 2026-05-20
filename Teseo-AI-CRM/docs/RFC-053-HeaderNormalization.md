# RFC-053: Normalización Case-Insensitive e Inyección Transversal de Headers

## 1. Estado Actual y Diagnóstico (Learner)

Tras el análisis de los middlewares y adaptadores en `src/orchestrator/src/`, se han detectado los siguientes patrones y vulnerabilidades potenciales en la manipulación de cabeceras:

- **Múltiples vías de inyección de Tenant ID**: Actualmente `ingestion-gateway.ts` extrae `x-tenant-id` y `x-gateway-nonce` usando Hono (`c.req.header()`). Aunque Hono ofrece cierta estandarización, se depende de la implementación subyacente. Adicionalmente, rutas internas como `leads-assign.ts` están extrayendo el `tenant_id` directamente desde el cuerpo del payload (JSON) en lugar de una cabecera estandarizada.
- **Validación de Firmas Fragmentada**: El Gateway extrae un subconjunto hardcodeado de cabeceras (como `x-hub-signature-256`, `authorization`, etc.) y lo pasa como un diccionario a los adaptadores (ej. `email.adapter.ts`). Si un proveedor envía variaciones de camelCase, y no se trata apropiadamente en este puente, puede fallar la autenticación silenciosamente.
- **Inmutabilidad**: Actualmente `tenantId` se estampa mutando el objeto de contexto (`metadata.tenantId = '' // gateway lo sobreescribe`).

## 2. Arquitectura Propuesta (Builder)

Para consolidar el Bloque 19, Objetivo 2, se propone la siguiente arquitectura basada en un pipeline de middlewares:

### 2.1 Middleware `header-normalizer.ts` (Global)
Crear e insertar un middleware global en el inicio del pipeline (antes de `ingestionGateway` y `rateLimiter`).
1. **Normalización Estricta:** Iterar `c.req.raw.headers` pasando todas las llaves a un objeto `Record<string, string>` puramente en minúsculas (`c.set('normalizedHeaders', headers)`).
2. **Extracción y Validación Temprana:** Obtener `x-tenant-id` y `x-gateway-nonce`. Si el valor es inválido, rechazar inmediatamente (HTTP 400).
3. **Inyección de Contexto Constante:** Definir `c.set('tenantId', tenantId)` a nivel superior, protegiendo este valor de mutaciones posteriores por adaptadores u otros middlewares.

### 2.2 Refactorización de `ingestion-gateway.ts`
El Ingestion Gateway debe volverse agnóstico a la extracción cruda:
- Consumirá el `tenantId` inmutable desde `c.get('tenantId')`.
- Pasará el objeto de contexto `normalizedHeaders` completo a `AdapterFactory` y a los `verifySignature` de cada adaptador. Ya no debe extraer un subconjunto hardcodeado de cabeceras de firma, permitiendo que canales futuros extiendan libremente las cabeceras requeridas.

### 2.3 Unificación de Canales y Rutas
- **Rutas Internas (ej. `leads-assign.ts`)**: Se refactorizarán para no depender de variables `tenant_id` en el body del POST, forzando a que la comunicación interna de la infraestructura (ej. microservicios u Odoo) pase el tenant mediante la cabecera `X-Tenant-Id`. Esto garantiza que la inyección sea verdaderamente transversal.

### 2.4 Transversalidad Hacia LangGraph
El `webhook.ts` delegará la instancia del hilo asíncrono con `workflowApp.invoke(...)`. Puesto que el `tenantId` está asegurado transversalmente por el normalizador, la inyección en el estado (`tenant_id: tenantId`) para los runnables de LangChain queda blindada.

## 3. Plan de Mitigación de Fallos

1. **Caída Silenciosa por Key Mismatch:** Al convertir todas las cabeceras a lowercase estricto en el normalizador, cualquier búsqueda (ej. `headers['x-api-key']` en el adaptador de Email) siempre acertará, mitigando fallos silenciosos de autenticación.
2. **Body Spoofing:** Eliminar `tenant_id` de los payloads internos imposibilita que un actor malicioso suplante la identidad del tenant reescribiendo el payload si logra evadir el gateway perimetral.
3. **Bloqueo Rápido (Replay Attacks):** Normalizar `x-gateway-nonce` en este primer eslabón permite crear en el futuro un middleware de idempotencia nativo (`idempotency-cache.ts`) sin contaminar la lógica de negocio de los webhooks.
