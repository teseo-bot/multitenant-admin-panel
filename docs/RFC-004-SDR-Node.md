# RFC-004: SDR Node Architecture (Sales Development Representative)

## 1. Objetivo y Alcance
El nodo SDR es el componente clave del `CRM-Agentico` encargado de interactuar con leads calientes o prospectos que requieren cualificación comercial. Su objetivo principal es emular a un ejecutivo de desarrollo de ventas (BDR/SDR), recolectar información estructurada (Framework BANT/MEDDIC simplificado) e integrarla con el CRM (Odoo/Postgres), siempre manteniendo un tono conversacional natural y conciso, apto para WhatsApp.

## 2. Mejores Prácticas de la Industria Aplicadas (LangGraph)
- **Tool-Calling Iterativo:** El SDR no solo genera texto libre, sino que usa herramientas (`bindTools`) para mutar el estado o verificar información (ej. disponibilidad de agenda) *antes* de responder al usuario.
- **Extracción de Entidades Acumulativa:** En lugar de forzar al LLM a extraer todo en un turno, el LLM emite llamadas a la herramienta `updateLeadProfile` progresivamente, alimentando un objeto persistente en el `GraphState`.
- **Handoff a Humano (HIL):** Capacidad explícita de "Yield" o enrutamiento a un agente humano en caso de frustración, intención explícita de hablar con soporte, o cuando el lead ya está calificado (SQL - Sales Qualified Lead).
- **Inmutable State Expansion:** Se debe extender `GraphState` para soportar `leadProfile` (datos cualificados) y `sdrStatus` (estado de la conversación).

## 3. Extensión Requerida en `GraphState` (en `src/state.ts`)
```typescript
  leadProfile: Annotation<Record<string, any>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  sdrStatus: Annotation<"prospecting" | "qualified" | "handoff">({
    reducer: (left, right) => right || left,
    default: () => "prospecting",
  }),
```

## 4. Herramientas (Tools) del Nodo
El nodo se instanciará con un `ToolNode` interno o en un subgrafo, pero inicialmente puede invocar llamadas directas:
1. `update_lead_profile(name, company, email, phone, need, timeline)`: Guarda los datos en el estado progresivamente.
2. `check_calendar_slots(date)`: Consulta disponibilidad (mock o API real) si el lead pide una llamada.
3. `escalate_to_human(reason)`: Cambia el `sdrStatus` a "handoff" y emite un mensaje final de espera.

## 5. Diseño del Nodo (`sdrNode.ts`)
1. **System Prompt:** 
   - Rol: "Eres un asesor comercial experto de Fleetco..."
   - Tono: Empático, respuestas extremadamente cortas (1-2 párrafos máximo, formato WhatsApp), sin saludos robóticos.
   - Reglas: No pedir todos los datos de golpe. Preguntar un dato a la vez. Siempre usar `update_lead_profile` en background cuando se detecte un dato nuevo.
2. **Modelo de IA:** 
   - Debe usar `ChatOpenAI` con soporte nativo de Tool Calling (ej. `gpt-4o-mini` o el modelo equivalente enrutado por el `AI Gateway`).
3. **Flujo Cíclico (Mini-grafo o Node Loop):**
   - El nodo evaluará si el modelo solicitó una herramienta. Si es así, ejecuta la herramienta, adjunta el `ToolMessage` y *vuelve* a invocar al LLM para que genere el texto final para el usuario.
   - Una vez que la IA emite un `AIMessage` puro de texto, se devuelve y termina la ejecución del nodo, regresando el control a Hono para despachar el webhook de WhatsApp.

## 6. Dictamen de Aprobación
- [ ] Validado contra principios Zero-Trust (El token se pasa por variable de entorno hacia `fleetco-ai-gateway`).
- [ ] Alineado a la Ley Marcial Documental (Este archivo reside en `Ai-crm-vault`).
- [ ] Preparado para delegación al Ejecutor.
