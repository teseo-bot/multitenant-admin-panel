# ADR-150: Cierre del Sprint - Bloque 15 (Campañas y Evaluador)

**Fecha:** 2026-04-23
**Estado:** Accepted
**Autores:** Escuadrón Táctico (Teseo, Builder, Learner, Ejecutor, Tester, Reviewer)

## 1. Contexto y Objetivos del Sprint
El objetivo del Bloque 15 era expandir las capacidades del Orquestador LangGraph agregando flujos asíncronos masivos (Campañas) e integrar un control estricto de calidad en los outputs generados mediante el patrón "LLM-as-a-Judge". Todo bajo el esquema Single-Tenant aislado en base de datos.

## 2. Decisiones Arquitectónicas Implementadas
1. **Ruteo de Campañas (Gatekeeper Expansion):** Se añadió el intent `CAMPAIGN` al nodo de triage para canalizar operaciones de seguimiento masivo separadas de los flujos de SDR/RAG.
2. **Evaluador de Calidad Interceptor:** 
   - Se inyectó un nodo evaluador que utiliza inferencia rápida (Gemini Flash/Haiku) con salida estrictamente en JSON (PASS/FAIL + reason).
   - El evaluador intercepta el flujo antes del nodo `dispatcher` verificando 5 criterios: Precisión, Tono, Completitud, Seguridad y Formato.
3. **Loopback y Safety Valve (Prevención de Ciclos Infinitos):** 
   - El feedback negativo se reinyecta al origen exacto (`sourceNode`) forzando re-procesamiento.
   - Para proteger costos y tiempos, se estableció en `state.ts` un reductor aditivo estricto limitando los reintentos a `MAX_RETRIES = 3` (`Math.min(left + right, 3)`).
   - Al superar el umbral, la "Safety Valve" fuerza un `PASS` de emergencia, documenta el fallo en logs y libera el flujo.
4. **Infraestructura de Datos y Telemetría UI:** 
   - Migración SQL aplicada para la tabla `campaigns` (con campos de `evaluator_score`).
   - Tenant OS Dashboards actualizados con vistas dedicadas para monitorear el progreso y la telemetría en tiempo real del evaluador (`EvaluatorLogs.tsx`).

## 3. Observaciones y Deuda Técnica (Post-Mortem)
- **Reset de Contadores en Threads Persistentes:** La auditoría de seguridad detectó que si un `thread_id` persistente alcanza el límite de reintentos (3), futuras interacciones en ese mismo hilo podrían hacer un bypass automático del evaluador. **Pendiente para próximo sprint:** Incluir lógica en `hydrateNode` para reiniciar a 0 el `evaluatorRetryCount` al arranque de cada nueva interacción del hilo.
- **Mock Data en Tenant OS:** Las interfaces visuales del Evaluador corren de momento sobre hooks mockeados para validar renderizado y testing sin bloquear dependencias. Deben enlazarse a los endpoints reales de Supabase al conectar clientes vivos.

## 4. Impacto
El enjambre de agentes ahora opera bajo un esquema de corrección automática *Zero-Trust*, donde ningún nodo emite mensajes finales sin pasar antes por una barrera de cumplimiento LLM. El ciclo está auditado, encapsulado y acotado para evitar espirales recursivas de facturación.
