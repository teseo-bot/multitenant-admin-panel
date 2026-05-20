# ADR-099: Agente de Soporte L1 y Telemetría Centralizada (Teseo DevOps)

| Campo | Valor |
|---|---|
| **ID** | ADR-099 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Builder (Planificador/Arquitecto Staff) |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Teseo-AI-CRM / Observabilidad |

## 1. Contexto y Problema
En el despliegue Single-Tenant (ADR-097), cada cliente (Innoteca, T4Oligo, etc.) tiene su propio Orquestador aislado corriendo en su propio proyecto GCP.
Si ocurre un fallo crítico (ej. Odoo caído, cuota de LLM excedida, o un error fatal en el `pgvector`), el error queda atrapado en los logs locales de Cloud Run de ese cliente. 
El equipo central de Teseo AIDevops se entera del problema de forma reactiva (cuando el cliente se queja) en lugar de proactiva, incrementando el *Mean Time To Detect* (MTTD) y dañando el SLA del SaaS.

## 2. Decisión
Implementar un **Agente L1 (Observador Silencioso)** como una capa de middleware de captura de excepciones globales en el servidor Hono (`src/orchestrator/index.ts`).

### 2.1 Mecánica del Agente L1
1. **Captura Global (Catch-All):** El bloque `catch` principal del webhook (`/api/webhook` y `/api/webhook/telegram`) capturará cualquier excepción no controlada arrojada por LangGraph, el LLM Router o la VectorDB.
2. **Contextualización (Empaquetado):** El error se empaquetará junto con el contexto del Tenant (Tenant ID, número de teléfono afectado, mensaje entrante que provocó el crash, y la traza del error).
3. **Notificación Push (Webhook):** El Orquestador del cliente disparará una petición HTTP asíncrona hacia un Endpoint Centralizado de Teseo (ej. un bot de Telegram interno de Teseo DevOps), usando la variable de entorno `TESEO_ALERT_WEBHOOK`.
4. **Formato de Alerta:**
   ```
   🚨 [L1-ALERT] Crash en Tenant: Innoteca (ID: 22222)
   - Canal: WhatsApp (+52 1 555 1234)
   - Error: Error fetching from Odoo (Timeout)
   - Acción sugerida: Revisar estado del contenedor Odoo.
   ```

## 3. Consecuencias y Siguientes Pasos
- **Pros:** Observabilidad instantánea sin necesidad de montar Datadog o Grafana por cada cliente. Soporte proactivo (el ingeniero arregla el fallo antes de que el cliente final lo note).
- **Contras:** Si el fallo es masivo o un loop infinito, el webhook de Teseo podría sufrir un bombardeo de notificaciones (Alert Fatigue).
- **Acción:** Crear `src/orchestrator/services/alert.ts` e inyectarlo en el bloque de excepciones del orquestador (`index.ts`).
