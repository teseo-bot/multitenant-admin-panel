# RFC-012: UX Pipelines & Human-In-The-Loop (HITL) Architecture

**Author:** Builder (Staff Architect)
**Status:** Draft / Proposed
**Date:** April 2026

## 1. Introducción
Este documento establece la arquitectura de flujos de interacción y herramientas para el ecosistema de agentes del `Teseo-AI-CRM`. Basado en las mejores prácticas extraídas de `prospect-ops`, `goal-driven`, `gbrain` y `alpha-eval.pdf`, el objetivo central es alcanzar una UX Conversacional indistinguible de un operador humano, eliminando fricciones robóticas, gestionando el traspaso a humanos (HITL) de forma invisible y operando con latencias y confirmaciones naturales.

## 2. Mapeo Maestro de Agentes y Nodos

### 2.1 Gatekeeper (Enrutador)
Actúa como la primera línea de contacto. No resuelve, clasifica y delega.
- **Funciones:** Triage inicial, detección de intención, asignación de sesión.
- **Tools/Skills actuales:**
  - `intent_router`: Enruta el payload al agente correspondiente.
  - `tone_analyzer` (alpha-eval): Detecta el nivel de formalidad, urgencia y uso de emojis del cliente para setear la "voz" de la sesión.
- **Tools/Skills a desarrollar:**
  - `spam_filter_evaluator`: Discrimina mensajes irrelevantes sin consumir tokens en sub-agentes.

### 2.2 SDR (Ventas y Cualificación)
Operación "Goal-Driven". Dirige la conversación hacia la cualificación BANT (Budget, Authority, Need, Timeline) de forma orgánica.
- **Funciones:** Lead scoring, prospección, agendamiento de llamadas.
- **Tools/Skills actuales:**
  - `calendar_booking`: Consulta disponibilidad y agenda en el calendario.
  - `crm_upsert_lead`: Crea o actualiza el registro en la BD.
- **Tools/Skills a desarrollar:**
  - `objection_handler_db`: Consulta un RAG específico de objeciones de ventas para respuestas persuasivas.
  - `soft_nudge`: Envía recordatorios sutiles si el cliente abandona a mitad de la agenda ("¿Pudiste revisar los horarios?").

### 2.3 RAG (Soporte / Conocimiento)
Conectado a `gbrain`. Provee respuestas técnicas y de soporte al cliente.
- **Funciones:** Resolución de dudas, manuales, status de servicio.
- **Tools/Skills actuales:**
  - `semantic_search`: Busca en la base de conocimiento (`gbrain`).
  - `fetch_client_status`: Consulta el estado de una orden/servicio del cliente.
- **Tools/Skills a desarrollar:**
  - `summarize_complex_doc`: Extrae partes de un manual y las explica "en sus propias palabras" en lugar de copiar/pegar viñetas.

### 2.4 Inbound Engine (Generador de Demanda - Futuro)
Opera en el marco de `prospect-ops`. Totalmente asíncrono.
- **Funciones:** Nurturing campaigns, follow-ups de carritos abandonados o leads fríos.
- **Tools/Skills a desarrollar:**
  - `campaign_trigger`: Dispara un mensaje inicial basado en un evento externo (webhook).
  - `contextual_hook_generator`: Genera un abridor de conversación basado en el historial previo del lead.

## 3. Prácticas de UX Conversacional (El factor "Indistinguible")

Para romper el paradigma de "bot de WhatsApp", el pipeline de salida debe pasar por un middleware de naturalidad:
1. **Asincronía y Tiempos de Lectura (Typing Delay):** Prohibido responder en 500ms. El sistema calculará el tiempo de "lectura" y "escritura" basado en la longitud de la respuesta (`alpha-eval` standard). Se simulará el estado "escribiendo...".
2. **Tone-Matching Dinámico:** Si el cliente usa jerga y emojis cortos ("Hola bro ✌️"), el agente se ajustará ("Qué onda, dime en qué te ayudo"). Si es formal, será formal.
3. **Confirmaciones Sutiles:** Reemplazar frases robóticas ("La información ha sido guardada en la base de datos") por respuestas humanas de baja carga cognitiva ("Listo, ya lo anoté.", "Vale, dame un segundo.").
4. **Manejo de Errores Naturales:** Si el bot no entiende, no debe decir "No entendí tu comando". Debe decir: "Perdona, me perdí un poco, ¿te refieres a X o a Y?".

## 4. Diagrama y Arquitectura HITL (Human-In-The-Loop) e Invisible Hand-off

El corte entre el Bot y el Humano no debe sentirse como una transferencia de call center.

### 4.1 ¿Cuándo escalar? (Triggers)
- **Sentiment Frustrado:** Uso de mayúsculas sostenidas, insultos, o frases repetitivas de queja.
- **Límite de Intentos:** Si el bot falla al extraer un dato (ej. fecha) más de 2 veces.
- **High-Ticket/Cierre:** Cuando la intención detectada es una compra directa o un deal complejo que requiere sensibilidad humana.
- **Solicitud Explícita:** El usuario dice "Quiero hablar con una persona".

### 4.2 ¿Cómo ocurre el hand-off en DB?
1. El agente (cualquiera de los 3) llama a la tool `escalateToHumanTool(reason, summary)`.
2. Esta tool realiza una mutación en la tabla `Sessions` del CRM:
   - `assigned_to`: "human_queue" (o un ID de agente humano).
   - `bot_paused`: `true`.
   - `hand_off_reason`: "frustration_detected".

### 4.3 El "Corte Invisible" (UX del cliente)
El bot tiene estrictamente prohibido responder "Te voy a transferir con un humano, por favor espera".
En su lugar, emitirá una **Frase Puente de Alta Fricción Simulada**:
- "Dame un segundo para revisar esto bien a detalle..."
- "Déjame checar esto con el equipo rápido, no tardo."

**Proceso del Operador:**
El operador humano recibe la alerta en la interfaz del `Teseo-AI-CRM` con el `summary` generado por el bot. El humano retoma la conversación desde el mismo hilo de WhatsApp. Para el cliente, es la misma entidad cambiando de ritmo, o simplemente un flujo natural de revisión sin la pared burocrática del "bot de soporte".
