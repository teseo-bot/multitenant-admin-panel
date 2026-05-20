# MEMORY.md — Puntero de Estado Activo [[AGENTS]]
> **ADR-067 (11 Abril 2026):** Este archivo tiene un límite estricto de 5KB. Todo contenido histórico vive en `memory/*.md`.

---

## 🔒 Reglas de Seguridad Críticas (Candado Permanente)
* **Candado de Borrado:** Prohibido borrado masivo sin confirmación del CEO de 3 pasos.
* **Rutas Maestras:** Uso EXCLUSIVO de rutas absolutas (`/Users/teseohome/projects/` y equivalentes).
* **Polyrepo & Single-Responsibility:** Un Docker/Agente por proyecto.
* **Directiva Documental (SSOT):** ADRs/RFCs viven en `FleetcoVault` o `/docs` del tenant. Prohibido cruzar dominios.
* **Ley Marcial Documental:** Cero archivos `.md` de diseño en `/projects/`.

---

## 🚀 Estado del Sprint (Puntero Activo)

### [✅] Histórico Comprimido (ver `memory/*.md` para detalle)
- **Bloques 10 al 15:** Core RAG, Evaluador (LLM-as-a-judge), Bypass de RLS y Mission Control MultiTenant completados.
- **Bloque 16:** Investigador (OSINT) & Hunter Node completados (Derivación ICP Vectorial).
- **Bloque 17:** Ingestion Gateway (Adapter Registry) completado y auditado (soporte a cabeceras unificadas).
- **Bloque 21 completado (24 Abril 2026):** Dispatcher Node (Emisión Omnicanal y Doble Persistencia).
  - Rediseño agnóstico de canales usando `AdapterFactory` inverso.
  - Sincronización en tiempo real del output de los agentes (SDR, Hunter, etc.) hacia la base de datos `inbox_messages` mediante `TenantScopedClient`.
  - Tolerancia a fallos: Si la API de WhatsApp/Telegram cae, LangGraph no colapsa y la persistencia local queda intacta.

---

### Puntero Bottom-Up (Próximo Objetivo) 🎯

**[🚀 PRÓXIMA SESIÓN — Bloque 22: Analytics & Andon Cords (Telemetría y Alertas)]**
- **Objetivo 1:** Construir la canalización de eventos de LangGraph hacia métricas en tiempo real (Supabase Timeseries / Aggregations) para visualizar en Asset Studio (Fase 4).
- **Objetivo 2:** Implementar el "Andon Cord" (RFC-036) — un hilo de Server-Sent Events (SSE) que alerte al tenant instantáneamente cuando un agente haga Handoff (HITL) o sufra un "Safety Valve Exception" en el Dispatcher.
