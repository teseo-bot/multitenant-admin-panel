# RFC-037: Protocolo de Handoff y Dead-Letter Queue (Resiliencia)

**Estado:** Propuesta
**Autor:** Builder (Arquitecto Staff)
**Fecha:** 21 de Abril de 2026
**Dependencias:** RFC-033, RFC-036, ADR-117

---

## 1. Objetivo

Definir la arquitectura para el **Control de Mando (Handoff)** entre el SDR Autónomo y los operadores humanos, y establecer la interfaz y mecanismos de resiliencia mediante una **Dead-Letter Queue (DLQ)** para auditar y recuperar eventos agénticos fallidos (asignaciones o envíos de mensajes).

---

## 2. Protocolo de Handoff (Control de Mando)

### 2.1 Problema
Cuando el usuario (operador) presiona "Tomar control" en la UI del Inbox, la base de datos local actualiza el estado, pero el grafo de LangGraph (que puede estar en medio de un ciclo RAG o en *sleep* esperando respuesta) no se entera inmediatamente, lo que puede causar que el agente responda concurrentemente con el humano (Race Condition Agéntica).

### 2.2 Arquitectura del Handoff

Se establece un flujo bidireccional estricto cuando se invoca la acción `take_over`:

1. **Invocación UI:** El cliente llama a `POST /api/leads/[id]/handoff`.
2. **Mutación CRM (Local):** 
   - Se ejecuta `UPDATE leads SET pipeline_status = 'human_active', assigned_node = 'admin', operator_id = $1 WHERE id = $2`.
   - Se dispara un evento `pg_notify('inbox_channel', { refresh: true })` para actualizar todas las UIs conectadas.
3. **Señal de Interrupción (Hacia LangGraph):**
   - El CRM ejecuta una llamada HTTP (Fire-and-forget con reintentos) hacia el Orquestador Hono: `POST /api/internal/graph/interrupt`.
   - **Payload:** `{ "thread_id": "<uuid>", "action": "pause", "operator_id": "<uuid>" }`.
4. **Mutación del Grafo:**
   - Hono utiliza la API de LangGraph (ej. `updateState`) para inyectar un cambio de estado forzado en el `thread_id`: `{ current_agent: 'human', pipeline_status: 'paused' }`.
   - Esto actúa como un *Breakpoint* o *Interrupt*, previniendo que el nodo SDR emita respuestas adicionales.

### 2.3 Esquema Zod de Payload (CRM → Orquestador)
```typescript
const GraphInterruptSchema = z.object({
  thread_id: z.string().uuid(),
  action: z.enum(['pause', 'resume', 'escalate']),
  operator_id: z.string().uuid(),
  reason: z.string().optional()
}).strict();
```

---

## 3. Arquitectura de Resiliencia (Dead-Letter Queue / Outbox)

### 3.1 Problema
Según lo propuesto en el RFC-033, los triggers de red (`pg_net`) o las llamadas a webhooks externos pueden fallar (Timeout, 5xx). Se requiere visibilidad total sobre estos fallos (Panel de Resiliencia) para no perder Leads ni Mensajes.

### 3.2 Tabla de Outbox (DLQ)
La tabla `lead_assignment_outbox` actuará como fuente de verdad para la DLQ.

```sql
CREATE TABLE lead_assignment_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'dead'
  attempts INT DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Ciclo de Vida del Evento (Resiliencia)
1. **Fallo de Transmisión:** Si `pg_net` o el Orquestador fallan repetidamente y agotan los 3 intentos, el registro pasa a `status = 'failed'`.
2. **Cronjob de Reintento:** Un job en Supabase (`pg_cron`) evalúa cada 5 minutos: 
   `UPDATE lead_assignment_outbox SET status = 'pending', attempts = attempts + 1 WHERE status = 'failed' AND attempts < 5`.
3. **Muerte del Evento (Dead-Letter):** Si `attempts >= 5`, el estado pasa a `'dead'`. Solo intervención manual puede sacarlo de este estado.

### 3.4 Panel de Resiliencia (UI)
Se desarrollará una vista en el Command Center para Administradores:
- **Ruta:** `/admin/resilience`
- **API Endpoint:** `GET /api/admin/dlq` (Filtra por `status IN ('failed', 'dead')`).
- **Acción Manual:** Un botón "Forzar Reintento" que ejecuta `POST /api/admin/dlq/[id]/retry`. Este endpoint muta el estado de nuevo a `'pending'` y ejecuta un webhook HTTP directo, bypasseando el cron.

---

## 4. Work Breakdown Structure (WBS)

### Fase 1: Handoff Backend
1. **Refactor de Endpoint:** Mover la lógica actual de `/api/threads/[id]/handoff` hacia `/api/leads/[id]/handoff`, actualizando directamente la tabla `leads` y generando el `pg_notify`.
2. **Cliente API Interna:** Implementar el cliente en Next.js para llamar a `POST /api/internal/graph/interrupt` usando el `INTERNAL_API_KEY`.

### Fase 2: LangGraph Interruptor
3. **Endpoint Hono:** Crear la ruta `/api/internal/graph/interrupt` en el orquestador.
4. **State Update:** Inyectar el estado `paused` al `thread_id` mediante la SDK de LangGraph.

### Fase 3: Infraestructura DLQ
5. **Migraciones DB:** Crear la tabla `lead_assignment_outbox` y el `pg_cron` schedule en Supabase.
6. **Trigger de Fallo:** Ajustar la respuesta de error de `pg_net` para insertar en la tabla de Outbox.

### Fase 4: Interfaz de Resiliencia
7. **APIs UI:** Crear `/api/admin/dlq` (GET) y `/api/admin/dlq/[id]/retry` (POST).
8. **UI Component:** Implementar la tabla de monitoreo en `/app/(dashboard)/admin/resilience/page.tsx`.

---

*Documento generado bajo Ley Marcial Documental. Aprobado por Teseo.*
