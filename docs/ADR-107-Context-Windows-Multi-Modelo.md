# ADR-107: Asignación de Context Windows Multi-Modelo

## 1. Contexto
Durante el ciclo de desarrollo de Teseo AI CRM y la orquestación del Escuadrón Táctico, se identificó un conflicto entre los límites de ventana de contexto (Context Window) que soportan los distintos modelos fundacionales configurados para los diferentes Agentes (Anthropic Claude 3.5 Sonnet = 200k tokens, vs. Gemini 3.1 Pro = 1M+ tokens).

OpenClaw Gateway gestiona la truncación y priorización en el envío del `MEMORY.md`, topología de código, y dependencias. Al no tener una segregación estricta, un sub-agente instanciado con Claude podía fallar por exceder los 200k, o el flujo en Gemini estaba siendo subutilizado artificialmente bajo un límite global conservador.

## 2. Decisión
Se establece una arquitectura de gobernanza de tokens a nivel del Orquestador de Gateway, donde el límite de contexto no es global estático para todos, sino segmentado jerárquicamente:

- **Límite Baseline Global (Anthropic-safe):** El parámetro `agents.defaults.contextTokens` queda anclado en `200,000` tokens para salvaguardar la operación de cualquier modelo de Claude que funja como Auditor (Reviewer) o Builder.
- **Límite Override Dinámico (Gemini-max):** Mediante la inyección en `agents.list[id].params.contextTokens`, se asignan `1,000,000` de tokens dinámicamente para las instancias principales (`main`, o roles delegados como Learner y Ejecutor) potenciados por Gemini 3.1 Pro.

## 3. Consecuencias
- **Pros:** Máxima optimización del throughput y capacidad RAG profunda para el Investigador (Learner), permitiéndole cargar repositorios extensos sin perder fidelidad. Prevención absoluta de excepciones HTTP 400 por *Token Limit Exceeded* en la familia Anthropic.
- **Contras:** Requiere gestión activa y manual en `openclaw.json` en caso de migrar el agente principal a un proveedor externo que no soporte 1M de tokens, o al asignar modelos locales con ventanas menores.

## 4. Estado
Aceptado. Implementado en la instancia de Gateway local mediante el API de configuración dinámica (`config.patch`).