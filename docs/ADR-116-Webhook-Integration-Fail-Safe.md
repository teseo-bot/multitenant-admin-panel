# ADR-116: Integración Webhooks LangGraph a Tenant OS y Política Fail-Safe
**Fecha:** 21 Abril 2026

## Contexto
Requeríamos conectar el orquestador AI (LangGraph) con el Tenant OS (Next.js/Supabase) para auditar en tiempo real las acciones de los agentes (SDR, Hunter, Gatekeeper) poblando el timeline de Campañas a través del endpoint `POST /api/campaigns/[id]/events`.

## Decisiones Arquitectónicas
1. **Observer Centralizado en LangGraph (RFC-020):** Se rechazó acoplar la llamada HTTP dentro de las herramientas del agente. Se implementó una función centralizada `dispatchEventsFromResult` que procesa los mensajes finales de forma *fire-and-forget* (promesa flotante) en el archivo raíz `index.ts`.
2. **Política Fail-Safe (M2M):** El orquestador nunca bloquea las respuestas hacia Meta o Telegram, y maneja reintentos exponenciales aislados si el endpoint del CRM está caído o saturado.
3. **Idempotencia Híbrida (RFC-019):** LangGraph emite un `X-Idempotency-Key` único por invocación. El CRM valida e inserta; si existe colisión (`PG Code 23505`), devuelve HTTP 409 con `{ success: true }` para indicar que el evento ya fue registrado sin fallar el proceso.
4. **AppSec Zero-Trust:**
   - Validaciones estrictas con Zod v4 (`.strict()`) para evitar polución JSON.
   - Seguridad M2M con `M2M_API_KEY` (Bearer Auth) + Validación de pertenencia del `campaignId` con el `tenantId` en Base de Datos.
   - Enmascaramiento obligatorio (maskPhone) de datos PII (números de WhatsApp/Telegram) en los logs de Cloud Run.

## Consecuencias
El sistema ahora audita autónomamente a los agentes AI. La topología permite a los nodos trabajar como funciones puras, dejando la telemetría delegada a un *Observer* que no interrumpe el flujo crítico de ventas.
