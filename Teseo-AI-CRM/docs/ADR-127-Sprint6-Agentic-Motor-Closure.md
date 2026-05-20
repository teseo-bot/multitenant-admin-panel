# ADR-127: Cierre del Sprint 6 - Motor Agéntico y Puente de Eventos

**Fecha:** 21 Abril 2026
**Estado:** Aceptado
**Dominio:** Orquestación (LangGraph) e Interfaz (Tenant OS)

## 1. Contexto y Objetivos del Sprint
El objetivo principal del Sprint 6 fue establecer el cerebro operativo autónomo de Teseo AI CRM: el Motor Agéntico impulsado por LangGraph. El reto radicaba en conectar la base de datos PostgreSQL (Supabase) con el orquestador (Hono) de forma segura, asíncrona, tolerante a fallos, y respetando las directivas topológicas (Team-C vs Team-L).

## 2. Hitos y Decisiones Tomadas

### 2.1 Puente de Eventos y Resiliencia (RFC-033)
- Se descartó el polling constante a favor de Webhooks de base de datos usando `pg_net` (disparados vía Triggers en Supabase).
- Se implementó un **Escudo de Idempotencia** de doble capa (Memoria + BD) en Hono para prevenir asignaciones duplicadas de Agentes derivadas de reintentos de red.
- Se introdujo un **Bloqueo Optimista (Optimistic Locking)** en la API inversa (`PATCH /api/internal/leads/[id]/assign-result`) verificando de manera estricta que `.eq('assigned_node', 'unassigned')`. El mecanismo probó soportar 20 peticiones concurrentes devolviendo 1 éxito y 19 bloqueos seguros (`HTTP 409 Conflict`).

### 2.2 Purga Topológica y Deuda Técnica UI (RFC-034)
- El Inbox sufrió un refactor mayor eliminando código muerto (`@detail` parallel routes).
- Se garantizó la inyección de `operatorId` a través del contexto seguro de Auth, y se implementó la responsividad en móviles (`Sheet` overlay en vistas estrechas, `ResizablePanelGroup` en escritorio).

### 2.3 Desacoplamiento Team-C y Team-L (ADR-126)
- Quedó sellada en piedra la separación arquitectónica. Los *Playbooks* y *Workflows* conforman el **Dominio de Estructura (Team-L)** y son de solo lectura para el Orquestador. La tabla `leads` y los historiales de chat son el **Dominio de Estado (Team-C)** y son el único ecosistema mutable por la Inteligencia Artificial.

### 2.4 Orquestador LangGraph (RFC-035)
- Se desarrolló el sub-grafo `sdr-triage` usando `Zod` y Tipos Estrictos (`SDRTriageState`).
- El Agente está capacitado para analizar, decidir (*engage, nurture, escalate, discard*) e interactuar con M2M Callbacks para devolver su veredicto.

## 3. Consecuencias
**Positivas:**
- El Tenant OS ahora posee la plomería completa para procesar leads autónomamente de extremo a extremo sin intervención humana.
- Riesgos de sobreescrituras en BD (Race Conditions) erradicados.

**Áreas a Observar:**
- Monitoreo del Dead-Letter Queue (`lead_assignment_outbox`). Se requerirá dotar a la UI (Dashboard) de visibilidad sobre los eventos de LangGraph fallidos.

## 4. Próximos Pasos
Implementar el renderizado en tiempo real de las respuestas del Agente en la interfaz del Inbox y consolidar el esquema de transferencia Humano-Agente (HITL Handoff).