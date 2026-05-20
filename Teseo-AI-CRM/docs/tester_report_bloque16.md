# Reporte de Pruebas Destructivas - Bloque 16
**Revisor:** Agente Tester (Ingeniero QA Destructivo / SDET)
**Fecha:** 23 de Abril de 2026
**Módulo:** Nodo Investigador e Inteligencia Competitiva RAG (Bloque 16)

## 1. Archivos Analizados y Sometidos a Prueba
- `src/services/icp-vectorizer.ts`
- `src/services/web-scraper.ts`
- `src/services/hunter-io-client.ts`
- `src/services/context-compactor.ts`
- `src/nodes/investigador.ts` (router conditional)

## 2. Metodología de Validación Local
Se diseñó un script de pruebas destructivas (`bloque16.test.ts`) utilizando la suite `vitest` que inyecta _edge cases_ en las funciones estáticas para evaluar su resistencia, sin depender de los APIs externos.

### Casos Ejecutados:
- **ICP Score Calculation (`ICPVectorizer`)**: 
  - Cálculo de Similitud Coseno con vectores en cero (`[0, 0]`), arrays asimétricos, y valores `null/undefined`. Confirmado que la capa matemática previene resultados `NaN` y excepciones mediante la evaluación de la norma a cero.
  - El ruteo `routeByICP` soporta caídas en el fallback de manera segura hacia `sdr` cuando falta la propiedad `signals.pain_points`.

- **Control de Excesos de Texto (`ContextCompactor`)**:
  - Inyección de objetos JSON masivos (arreglos con más de 100 elementos, cadenas de 40,000 caracteres de relleno y atributos inexistentes).
  - La compactación gradual del modelo asegura que primero se truncan los arreglos como `tech_stack` y `competitor_mentions`. Si aun así el JSON excede los 800 tokens estimados, se aplica un slice drástico preservando únicamente los identificadores esenciales.

- **Timeouts & Abort Controllers (`WebScraperService` y `HunterIoClient`)**:
  - Se interceptó y se hizo _mock_ del objeto global `fetch`, inyectando retrasos artificiales de 10 segundos. 
  - Las promesas internas usan `AbortController` (8s en Scraper y 5s en Hunter). Ante el rechazo `AbortError`, las clases responden de manera resiliente usando el catch-block para devolver `null` (scraper) y las reglas de `fallbackMatch` (hunter) en vez de crashear el servidor.
  - Verificación de limpieza del HTML parseado para prevenir el arrastre de etiquetas no deseadas `<script>` o `<style>` al texto enviado al LLM.

- **Router Condicional del Grafo (`routeAfterInvestigador`)**:
  - Inyección en la función de control de LangGraph (`routeAfterInvestigador`). Se pasó un estado modificado asumiendo problemas de inyección como valores nulos, objetos vacíos, y cadenas erróneas.
  - El sistema siempre derivó predeterminadamente al nodo `sdr` previniendo errores de estado en el StateGraph y una interrupción no contemplada del flujo de LangGraph.

## 3. Conclusión
El código implementado en el bloque 16 demuestra un manejo sobresaliente y sólido ante errores previstos. Los tiempos de respuesta están acotados por red y la lógica matemática es segura. La capa de compactación previene roturas del LLM por el límite de tokens. 

**Dictamen:** **PASS**

Los componentes son seguros y listos para ser revisados por la auditoría final del agente Reviewer.
