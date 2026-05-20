# ADR 095: Seguridad OWASP para LLMs en crm-agentico (Red Teaming & Zero-Trust)

## 1. Contexto
En el desarrollo de `crm-agentico`, utilizamos LangGraph para orquestar agentes conversacionales (ej. Agente SDR) que interactúan con APIs externas como Gmail y Google Calendar a través de llamadas a herramientas (*Tool Use*). La exposición directa a inputs de usuarios sin filtros adecuados introduce vulnerabilidades críticas catalogadas por OWASP LLM (ej. *Prompt Injection*, *Excessive Agency*, *Insecure Output Handling*). 

Dado el potencial riesgo reputacional y operativo de un agente enviando correos o agendando citas en nombre de teseo.lat bajo manipulación maliciosa, es imperativo establecer un diseño defensivo antes de llegar a Producción.

## 2. Solución Propuesta
Se implementa una arquitectura **Zero-Trust** y de **Privilegios Mínimos** (Least Privilege) en todos los nodos LangGraph, con las siguientes directivas obligatorias:

1. **Separación de Contexto (Defensa vs Prompt Injection):**
   - El *System Prompt* (instrucciones base) estará estrictamente separado del input del usuario.
   - Todo *User Input* debe ser delimitado por marcadores semánticos (ej. `<user_input>...</user_input>`) y parseado dinámicamente como datos, no como instrucciones ejecutables.
   
2. **Control de Agencia (Prevención de Excessive Agency):**
   - **Scopes Limitados:** Los *Tools* expuestos al LLM deben estar atados a credenciales con el scope más bajo posible (ej. leer horarios de calendario `calendar.readonly`, no eliminar ni editar eventos pasados).
   - **Human-in-the-Loop (HITL):** Cualquier acción destructiva o de alto impacto hacia el cliente (ej. envíos de correos de prospección en frío, mutaciones de facturación) requerirá un estado de espera (interrupción) en el grafo para aprobación manual antes de despachar al API.

3. **Sanitización Estricta (Insecure Output Handling):**
   - Hono (Backend) actuará como un *Gateway de Validación*. Todo JSON o respuesta emitida por un *ToolNode* ejecutado por el LLM será validado mediante esquemas rígidos (ej. Zod) antes de impactar la base de datos o el frontend.
   - El renderizado de respuestas en interfaces debe neutralizar cualquier payload ejecutable (previniendo XSS inducido por el LLM).

## 3. Consecuencias y Restricciones
- **Pro:** Se minimiza la superficie de ataque y el riesgo de que el SDR actúe de manera perjudicial.
- **Contra:** Aumento en la complejidad del orquestador LangGraph.
- **Restricción:** Mayor latencia por las validaciones adicionales (Zod) en Hono y posible fricción operativa al tener que aprobar correos bajo el modelo HITL.
