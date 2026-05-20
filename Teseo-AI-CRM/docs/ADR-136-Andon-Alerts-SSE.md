# ADR-136: Andon System Alerts (SSE)

## 1. Contexto y Problema
En el contexto del Bloque 8 (FinOps, Alertas y Dashboard Core), necesitamos un mecanismo proactivo para notificar a los operadores humanos sobre anomalías sistémicas críticas (ej. fallos del Event Bridge, desconexiones del LLM, picos anómalos de consumo de tokens). Depender exclusivamente del polling degrada la capacidad de respuesta (SLA de mitigación).

## 2. Decisión Arquitectónica
Implementaremos un "Cordón Andon" (Andon Cord) digital. Un sistema global de alertas push en tiempo real basado en **Server-Sent Events (SSE) y PostgreSQL LISTEN/NOTIFY**, adhiriéndonos al mismo patrón idempotente utilizado en el `inbox_channel` (RFC-021 / ADR-117).

### 2.1 Restricciones Inquebrantables
1. **Cero-Zustand para Datos en Vivo:** Las alertas se inyectarán directamente en el caché de TanStack Query v5 (`queryClient.setQueryData`) (ADR-111).
2. **Aislamiento Multitenant (ADR-135):** El canal de PostgreSQL debe estar estrictamente acotado por `tenant_id`. El backend verificará el Tenant extraído de los headers/host antes de suscribir el stream.
3. **Control de Fugas de Memoria:** El endpoint Route Handler implementará manejadores `abort` para limpiar los listeners de Postgres al desconectarse el cliente, evitando saturar el Pool (ADR-117).

## 3. Topología de Componentes

### 3.1 Base de Datos (PostgreSQL / Supabase)
- **Canal de Notificación:** `LISTEN tenant_alerts_channel`
- **Payload Esperado (JSON):**
  ```json
  {
    "type": "alert_created" | "alert_resolved",
    "tenant_id": "uuid",
    "severity": "info" | "warning" | "critical",
    "code": "EVENT_BRIDGE_FAIL",
    "message": "Descripción de la alerta",
    "timestamp": "ISO8601"
  }
  ```

### 3.2 Capa API (Next.js Edge / Cloud Run)
- **Endpoint:** `GET /api/system/alerts/stream/route.ts`
- **Responsabilidad:** Autenticar al operador, resolver el `tenant_id`, abrir conexión persistente a la DB, convertir eventos de PG a formato SSE (`data: JSON\n\n`) y orquestar el `keepalive`.

### 3.3 Capa React Hooks
- **Hook:** `hooks/use-system-alerts-sse.ts`
- **Mecánica:** Utiliza `EventSource` con política de reconexión exponencial. Al recibir el evento, evalúa el `severity`. Si es `critical`, detona un Toast destructivo inmediato, e invalida la query `queryKeys.system.alerts`.

### 3.4 Capa UI
- **Ubicación:** Integrado en el `Command Center Shell` (Layout global) para que el estado de alerta cruce cualquier ruta.
- **Componentes (Shadcn):** 
  - `Sonner` (Toasts globales)
  - `Alert` / `AlertTitle` / `AlertDescription` (Banners fijos superiores para estados de caída de servicios).

## 4. Work Breakdown Structure (WBS) para Ejecutor

| ID | Tarea | Componente Afectado | Criterio de Aceptación |
|----|-------|---------------------|-------------------------|
| 1.1 | Endpoint SSE API | `app/api/system/alerts/stream/route.ts` | El endpoint responde 200 OK con `Content-Type: text/event-stream`. |
| 1.2 | Suscripción PG (Listen) | `app/api/system/alerts/stream/route.ts` | Se suscribe al canal `tenant_alerts_channel` usando la instancia Supabase configurada. Cleanup de listeners en disconnect. |
| 2.1 | Hook TanStack Query | `hooks/use-system-alerts-sse.ts` | Captura `EventSource`, maneja reconexión, parsea el JSON e invoca `queryClient.setQueryData`. |
| 2.2 | Inyección Global UI | `components/command-center/command-center-shell.tsx` | El Shell invoca `useSystemAlertsSSE()`. |
| 3.1 | Test (Manual DB) | Supabase SQL Editor | Ejecutar `NOTIFY tenant_alerts_channel, '{"severity": "critical"}'` detona un Toast en UI. |

## 5. Consecuencias
- **Positivas:** El sistema obtiene capacidades de monitoreo proactivo en tiempo real (FinOps & SysOps) sin sobrecargar el frontend con peticiones periódicas.
- **Negativas:** Introduce una segunda conexión SSE simultánea (junto al Inbox), requiriendo ajuste de límites concurrentes en HTTP/2 si la escala aumenta masivamente.
