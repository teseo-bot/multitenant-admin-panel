# Reporte de Impacto: Integración de Webhook Personalizado (Proxy Multi-Tenant)

## 1. Objetivo Técnico y Topología
Habilitar en **Mission Control** un motor de enrutamiento (API Gateway proxy) para que cada inquilino posea una URL de Webhook estática y personalizada generada desde su UI. Esta URL recibirá los eventos de Meta (WhatsApp) y Telegram, y los redirigirá nativamente al contenedor `Cloud Run` aislado del inquilino correspondiente, preservando el patrón Single-Tenant (ADR-097).

## 2. Restricciones Inquebrantables (TeseoKDB / ADRs)
1. **Preservación de Firma Criptográfica (X-Hub-Signature-256):** Según la documentación de integraciones webhook, Meta valida estrictamente las firmas mediante HMAC-SHA256. El Proxy en Mission Control tiene **estrictamente prohibido** alterar, parsear o reserializar el payload JSON. El body debe fluir de forma cruda (`Raw Body`) para evitar fallos de validación en el Orquestador Hono.
2. **Latencia y Control de Concurrencia (WBS-Hono-Webhook):** Meta exige respuestas `200 OK` inmediatas. El proxy de Mission Control no debe esperar a que el LLM del Orquestador procese el mensaje; solo debe esperar el acuse de recibo asíncrono (HTTP 200) que emite Hono.
3. **Cero Retención:** Mission Control es solo un conducto (API Gateway). No debe guardar PII ni mensajes en su base de datos Supabase, garantizando la soberanía de los datos (ADR-097).

## 3. Archivos Modificados e Interacción de Componentes

### Módulo: Mission Control (`src/mission-control/src/`)
1. **[NUEVO] `app/api/webhooks/tenant/[id]/[channel]/route.ts`**
   - **Rol:** Endpoint Edge/Proxy.
   - **Lógica:**
     1. Extrae `id` (tenant_id) y `channel` (whatsapp/telegram).
     2. Consulta Supabase `tenants.orchestrator_url` (cacheado).
     3. Captura los headers entrantes y el `req.arrayBuffer()` (payload binario crudo).
     4. Ejecuta `fetch` reenviando el tráfico hacia `${orchestrator_url}/api/webhook/${channel}`.
     5. Retorna la respuesta al emisor (Meta).
2. **[MODIFICACIÓN] `app/tenants/[id]/page.tsx`**
   - **Rol:** UI del Inquilino.
   - **Lógica:** Añadir una nueva Tarjeta (`Card`) llamada **"Webhook Endpoints"**.
   - **Acción:** Mostrar la URL dinámica (ej. `https://{mission-control-domain}/api/webhooks/tenant/{tenant_id}/whatsapp`) con funcionalidad de "Copy to Clipboard" para facilitar la vida del operador.

## 4. Efectos Secundarios y Mitigaciones
- **Cache Miss de Supabase en el Bucle Caliente:** Consultar `orchestrator_url` en Supabase por cada mensaje de WhatsApp entrante añadirá entre 50ms y 150ms.
  - *Mitigación:* Implementar memoria caché a corto plazo (`unstable_cache` de Next.js o caché global en memoria) que almacene el `orchestrator_url` por tenant_id con TTL de 5 minutos, dado que la URL de Cloud Run rara vez cambia tras el despliegue.
- **Gestión de Respuestas de Configuración (Setup Meta):** Meta realiza requests HTTP `GET` durante la configuración (con `hub.challenge`). El proxy debe reenviar los `GET` y devolver el texto plano de respuesta exactamente como lo requiere la validación.

---
**Petición de Autorización:**
El flujo de hidratación y arquitectura están asegurados. Solicito autorización para despachar al Ejecutor y escribir la implementación del proxy inverso en Next.js y los componentes de UI.