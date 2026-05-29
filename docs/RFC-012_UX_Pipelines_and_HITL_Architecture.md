# RFC-012: Arquitectura de Pipelines UX, Mapeo de Herramientas y Human-In-The-Loop (HITL)

**Autor:** Teseo / Builder (Arquitecto Staff)
**Fecha:** 18 de Abril de 2026
**Estado:** Propuesta (Draft)
**Proyecto:** Teseo-AI-CRM

---

## 1. Contexto y Objetivos
Siguiendo las directrices del CEO y el análisis de la base de conocimientos (`prospect-ops`, `goal-driven`, `gbrain`, `alpha-eval.pdf`), este documento formaliza el diseño de los pipelines conversacionales del Teseo-AI-CRM. 

El objetivo primordial es lograr una **UX Conversacional Indistinguible (Turing-grade)**. Esto exige eliminar el comportamiento robótico (respuestas instantáneas, muros de texto, confirmaciones rígidas) e implementar asincronía, adaptación tonal (tone-matching) y transferencias a humanos (HITL) verdaderamente invisibles.

---

## 2. Principios de UX Conversacional (Destilado RAG)

Basado en las evaluaciones de `alpha-eval.pdf` y las metodologías de `prospect-ops`, la arquitectura aplicará estos patrones en la capa de interacción (LangGraph + Hono):

1. **Asincronía Simulada:** Los agentes no deben responder en 0.5 segundos. Implementaremos retrasos calculados (jitter de 2-4s) en base a la longitud de la respuesta esperada.
2. **Micro-Confirmaciones y Continuidad:** Evitar "He consultado la base de datos y su cita está lista." Preferir confirmaciones conversacionales y fraccionadas: "Dame un segundo, reviso la agenda..." -> "Listo, quedo para el martes. ¿Te parece bien?".
3. **Tone-Matching Dinámico:** El Gatekeeper inyectará un parámetro `user_tone` (formal, casual, impaciente) en el estado (AgentState) para que los nodos subsecuentes ajusten su prompt (system message).
4. **Handoff Invisible:** Prohibido usar frases como "Transfiriendo con un humano". La transición debe sentirse como si la misma persona pasara el teléfono a un supervisor o continuara la charla.

---

## 3. Mapeo Maestro de Agentes y Herramientas (Nodes & Tools)

La topología de la máquina de estados se divide en 4 nodos principales que heredan del estado global:

### 3.1. Nodo 1: Gatekeeper (Enrutador)
Actúa como la corteza prefrontal (`gbrain` pattern). No ejecuta acciones de negocio, solo clasifica, extrae el tono y delega.
* **Skills/Tools Actuales:**
  * `route_intent(thread_id, query)`: Determina el siguiente nodo (SDR, RAG, Human).
  * `detect_tone(query)`: Actualiza el `AgentState.user_tone`.
* **Skills/Tools a Desarrollar:**
  * `spam_filter()`: Detección temprana de bots o mensajes basura.

### 3.2. Nodo 2: SDR (Ventas y Cualificación)
Implementa la lógica de `goal-driven` prospect ops. Su misión es cualificar y agendar, persiguiendo un objetivo de conversión.
* **Skills/Tools Actuales:**
  * `check_calendar_availability(date)`
  * `book_meeting(lead_data, time_slot)`
* **Skills/Tools a Desarrollar:**
  * `extract_qualification_metrics(chat_history)`: Extrae BANT (Budget, Authority, Need, Timeline) silenciosamente.
  * `prospect_enrichment(phone_number)`: Usa Clearbit/LinkedIn para enriquecer el lead en background.

### 3.3. Nodo 3: RAG (Soporte y Conocimiento)
Nodo para retención, aclaración de dudas técnicas y soporte post-venta.
* **Skills/Tools Actuales:**
  * `query_vector_db(query, context)`: Búsqueda semántica en base de conocimientos.
* **Skills/Tools a Desarrollar:**
  * `fetch_ticket_status(user_id)`: Consulta estado de incidentes en el CRM.
  * `generate_step_by_step(document)`: Trocea manuales largos en píldoras enviadas mensaje por mensaje.

### 3.4. Nodo 4: Inbound Engine (Generador de Demanda - Futuro)
Ejecuta campañas asíncronas de "nurturing" sobre leads fríos.
* **Skills/Tools a Desarrollar:**
  * `schedule_followup(thread_id, delay_days, context)`
  * `analyze_engagement_score(thread_id)`

---

## 4. Arquitectura de Human-In-The-Loop (HITL)

El paso de control al humano debe ser estructural, no solo un cambio de prompt. LangGraph se pausará formalmente usando interruptores de estado.

### 4.1. Disparadores (Triggers) de Escalamiento
1. **Explícito:** El cliente pide hablar con alguien.
2. **Frustración:** Análisis de sentimiento negativo sostenido.
3. **Alto Valor:** El SDR detecta un Lead Enterprise (Budget > $X).
4. **Fallback:** El bot entra en loop o no sabe la respuesta 2 veces seguidas.

### 4.2. Flujo de Handoff (Paso a Paso)
1. **Invocación de Tool:** El bot llama a la herramienta interna `escalateToHumanTool(reason, summary)`.
2. **Pausa de Grafo:** El servidor Hono intercepta esto y marca `AgentState.is_human_routed = true`. LangGraph lanza un `Interrupt` (pausa el flujo para este `thread_id`).
3. **Alerta Silenciosa:** Se emite un webhook hacia el Dashboard del equipo o a Slack: *"🔥 Lead Caliente (Juan) requiere atención. Resumen: Quiere un plan Enterprise pero duda del SLA."*
4. **Toma de Control:** El operador humano entra al Dashboard de WhatsApp y escribe. El cliente recibe el mensaje de WhatsApp desde el mismo número, asumiendo que el "agente" anterior fue a consultar algo y regresó, o que se sumó un experto. No hay mensaje de "Transfiriendo...".
5. **Retorno a Bot (Opcional):** El operador, tras cerrar la duda, puede presionar un botón "Devolver al Bot". El sistema invoca `resumeBotTool(human_summary)`, actualizando la memoria de LangGraph para que el bot tenga contexto de lo que el humano acaba de acordar.

---

## 5. Próximos Pasos (Dependencias)
1. Integrar `user_tone` y asincronía en el `Gatekeeper`.
2. Desarrollar la herramienta `escalateToHumanTool` con soporte de `Interrupt` en LangGraph.
3. Desplegar endpoints webhook para notificar al humano.

*Aprobación requerida por el CEO para comenzar implementación del paso 1.*