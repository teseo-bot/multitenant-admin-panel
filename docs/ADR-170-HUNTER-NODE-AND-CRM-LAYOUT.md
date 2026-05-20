# ADR-170: Integración del Nodo Hunter y Refactorización del Layout CRM

## Status
Proposed (Builder Phase)

## Contexto
El sprint actual ("Lógica de Venta CRM") requiere dos cambios fundamentales en la arquitectura del sistema:
1. **Inteligencia OSINT (Nodo Hunter):** El orquestador requiere capacidades de enriquecimiento de datos de leads mediante OSINT (búsqueda web, extracción de información pública). Este nodo debe ser inyectado en LangGraph.
2. **Interfaz Operativa de Venta (Layout CRM):** El frontend requiere una reestructuración de su layout para acomodar el historial de chat (70% altura), caja de herramientas fija, y paneles asíncronos para visualización de los datos extraídos por el orquestador (Resumen semántico IA y Expediente Hunter), garantizando que las actualizaciones vía SSE repinten reactivamente estos bloques.

## Decisiones Técnicas

### 1. Inyección del Nodo Hunter (LangGraph)
- Se añade el "Nodo Hunter" como un sub-grafo o tool invocado dinámicamente por el Agente Orquestador en el backend (Cloud Run / Supabase Edge Functions).
- La salida del Hunter se anexará al objeto JSON del Lead (Expediente) y se persistirá en Neon Tech.
- Se exigirá validación estricta de estado (limpieza de `checkpoints` tras pruebas para evitar contaminación de RAM conversacional).

### 2. UI/UX: Layout de Detalle del Lead
- **Estructura CSS:** Se utilizará un modelo Flex/Grid donde el viewport se divida en componentes de altura fija vs adaptable. El "Chat Frame" usará `flex-grow` con `overflow-y: auto`, logrando que la zona de mensajes sea el 70% relativo, mientras el "Toolbar" será estático al final (`position: sticky` o contención Flex pura sin perder visibilidad).
- **Reactividad Híbrida:** Dado el ADR-113 (Neon Tech Postgres + SSE), el panel del "Expediente Hunter" y el "Resumen Semántico" se suscribirán a los mismos eventos SSE del Inbox. Cuando Neon Tech emita un NOTIFY de actualización sobre el perfil del Lead, la UI invalidará la caché del estado local y forzará el renderizado de los componentes semánticos y el panel OSINT en tiempo real, sin requerir F5.

### 3. Backend: Limpieza y Lógica de Transferencia a Pipeline
- Un trigger o función de negocio evaluará: `if(lead.name && lead.phone && lead.intent) -> enable_pipeline_transfer`.
- El pase manual inyectará un evento que moverá al usuario de estado "Inbox" a "Pipeline: Columna 1", insertándolo en Neon Tech y notificando al Frontend.

## Consecuencias
- **Positivas:** El vendedor tendrá toda la telemetría, chat e inteligencia del Lead en una sola vista que se nutre en tiempo real.
- **Riesgos:** La actualización agresiva por SSE en paneles grandes (Expediente) puede causar re-renders innecesarios. Se requerirá usar `React.memo` o estrategias de granularidad en la suscripción de estado del frontend para evitar degradación de FPS.