# ADR-095: Desacoplamiento del LLM y Centralización de Inyección (AI Gateway)
## Fecha: 17 de Abril 2026
## Estado: Aprobado

## 1. Contexto
Durante el despliegue a Cloud Run (Track Primario), el orquestador experimentó múltiples crash silenciosos (HTTP 200 en Webhooks, pero el LangGraph no completaba su ejecución).
El diagnóstico forense arrojó que el error base era un `401 Unauthorized` proveniente de OpenAI (canalizado a través del `fleetco-ai-gateway`).
Al intentar mitigar este error parcheando la variable `OPENAI_API_KEY` directamente en `src/index.ts` o en los descriptores de Cloud Run, se generó un acoplamiento frágil: cada nodo (`sdr.ts`, `rag.ts`, `gatekeeper.ts`) instanciaba su propio cliente de LangChain, inyectando variables (`AI_GATEWAY_TOKEN`) de forma *hardcodeada*, rompiendo el estándar.

## 2. Decisión
Alineados con el Zero-Trust Pipeline y la Ley Marcial Topológica, se prohíbe el uso de constructores LLM distribuidos a lo largo del código.
Se aprueba el siguiente patrón de diseño:

1. **Singleton Provider (`src/services/llm.ts`):** 
   - Se creará una fábrica centralizada o instancia Singleton para exportar `ChatOpenAI`.
   - Esta instancia inyectará por defecto el `baseURL` apuntando a nuestro AI Gateway y el `X-Tenant-Id` requerido para el FinOps.
   
2. **Estándar LangChain:**
   - Se elimina la inyección forzada en el código. El orquestador consumirá EXCLUSIVAMENTE las variables oficiales (`OPENAI_BASE_URL` y `OPENAI_API_KEY`) desde el entorno de ejecución (Secret Manager en GCP o `.env` local).
   - Nuestro AI Gateway validará el `OPENAI_API_KEY` simulando la firma de OpenAI.

3. **Manejo de Errores (Resiliencia):**
   - La instancia central debe estar envuelta en un bloque `try/catch` que evite los fallos silenciosos. Si el LLM falla, el sistema devolverá una excepción parseada a los webhooks (evitando dejar al usuario final en "Visto").

## 3. Consecuencias
- **Positivas:** El código queda agnóstico. Cambiar de proveedor (ej. migrar el Gateway a Gemini o Claude) requerirá un solo cambio en `llm.ts`. Limpieza del entorno de ejecución en Cloud Run.
- **Negativas:** Refactorización obligatoria de los 3 nodos actuales. Las pruebas unitarias (`sdr.test.ts`, etc.) requerirán actualizar los mocks del LLM.

## 4. Plan de Ejecución
1. Crear `src/services/llm.ts` (Implementar la fábrica).
2. Limpiar `src/index.ts` (Eliminar los *hacks* de `process.env`).
3. Refactorizar `src/nodes/gatekeeper.ts`, `rag.ts` y `sdr.ts` para importar la instancia central.
4. Ejecutar Suite de Pruebas Unitarias local antes del *deploy*.
