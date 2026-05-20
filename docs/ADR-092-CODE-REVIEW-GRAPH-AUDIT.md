# ADR 096: Estandarización de Auditoría AST con Code-Review-Graph

## 1. Contexto
En el pipeline de 5 agentes definido por el protocolo de Mission Control (Teseo, Builder, Learner, Ejecutor, Tester, Reviewer), las decisiones de pase a producción son tomadas de manera autónoma por el **Reviewer (Auditor)** basándose en el reporte de pruebas del **Tester**. 

Sin embargo, los enfoques tradicionales basados únicamente en los *diffs* de git son insuficientes para medir los efectos secundarios reales de las modificaciones (ej. si el Ejecutor altera un tipo o middleware base en Hono, el impacto puede derribar múltiples módulos silenciosamente). Necesitamos una evaluación estructural objetiva.

## 2. Solución Propuesta
Se establece como **estándar obligatorio** la inyección de `code-review-graph` en el pipeline de los agentes de validación.

1. **Evaluación Estructural de Ramificaciones (Blast Radius):**
   - Antes de que el Reviewer apruebe un Pull Request, correrá un análisis de Árbol de Sintaxis Abstracta (AST) usando `code-review-graph`.
   - Se evaluará el *Blast Radius* (radio de impacto) del código modificado. Si el índice de impacto es "Alto" (ej. cambios en capas de infraestructura o middlewares de Hono) y no está acompañado del nivel adecuado de validación, el despliegue es rechazado automáticamente.

2. **Detección de Test Gaps:**
   - El agente Tester empleará el análisis de grafo de dependencias para calcular los *Test Gaps* reales.
   - Todo nodo/función expuesta en el grafo de ejecución que carezca de un test unitario correspondiente fallará la inspección ("FAIL"). Esto previene que el Ejecutor declare una tarea terminada sin su arnés de prueba.

3. **Criterios de Autorización (Zero-Trust Loop):**
   - Un código será promocionado a "Done" **únicamente si** el `code-review-graph` garantiza que el *Blast Radius* está completamente contenido por la suite de pruebas actual.

## 3. Consecuencias y Restricciones
- **Pro:** Se elimina la subjetividad en las auditorías de código generadas por IA. El Reviewer obtiene una visión arquitectónica tridimensional antes de emitir un PASS.
- **Contra:** Aumenta el tiempo de cómputo en la etapa de Testing/Review (el análisis AST puede ser costoso computacionalmente para repositorios masivos).
- **Restricción:** El orquestador y los contenedores de los agentes Tester y Reviewer deben incluir las dependencias de librerías AST (parsing de TypeScript/Go) requeridas por `code-review-graph`.
