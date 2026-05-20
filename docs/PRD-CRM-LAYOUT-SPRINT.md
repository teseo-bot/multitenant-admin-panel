# Product Requirements Document (PRD) - Sprint: Lógica de Venta CRM (Frontend/Backend)

## 1. Meta del Sprint
Habilitar el pase a Pipeline y la operación completa del vendedor dentro del CRM, asegurando un Zero-Trust Pipeline Rollout. El Inbox ya recibe actualizaciones por SSE; la prioridad ahora es la funcionalidad operativa de la vista Kanban (Pipeline) y el detalle del Lead, así como la incorporación del nodo de inteligencia "Hunter" en LangGraph para OSINT (Open Source Intelligence).

## 2. Frente Data & AI (Backend)
### 2.1. Limpieza y Refactorización de Estado
- **Acción:** Purgar los 4 registros mock actuales en el pipeline de ventas en Neon Tech (Postgres).
- **Lógica de Transferencia (Lead Qualification):**
  - Implementar lógica backend para que un Lead que acumule suficientes datos (Nombre, Teléfono, Correo, Necesidad/Intención) sea elegible para entrar al Pipeline.
  - La transferencia debe poder realizarse automáticamente o a través del trigger manual del vendedor (botón explícito en Inbox).

### 2.2. Nodo "Hunter" (LangGraph)
- **Topología:** Integrar el Nodo "Hunter" al grafo principal para búsqueda web/OSINT.
- **Protocolo de Integración:** Se deben cumplir todos los puntos del Checklist de Integración de Tools de `AGENTS.md`:
  - Listado en `ToolNode`.
  - `addConditionalEdges` en el nodo del agente hacia "tools".
  - `addEdge` de retorno hacia el nodo original.
  - Limpieza de checkpoints (`TRUNCATE TABLE checkpoints CASCADE`) al finalizar pruebas.

## 3. Frente UI/UX (Frontend)
### 3.1. Inbox View
- Incorporar botón de acción explícita ("Mover a Pipeline" / "Cualificar Lead") que invoque el endpoint de transferencia.

### 3.2. Pipeline Board (Kanban View)
- Las tarjetas del board (Cards) deben renderizar reactivamente:
  - Nombre del Lead.
  - Canal de Origen (Etiquetas visuales: WA, IG, FB).
  - Tiempo de inactividad / Última interacción (formateado en horas/días).

### 3.3. Kanban Operational View / Detalle del Lead (Layout Refactor)
- **Distribución Estructural:**
  - **Historial de Chat:** Ocupa un *frame* del 70% de la altura total de la pantalla. El scroll de mensajes debe comportarse limpiamente, pasando *por debajo* de la caja de texto.
  - **Caja de Texto & Toolbar:** Elemento *fixed* en la parte inferior de la ventana, con todas las herramientas operativas activas (enviar texto, adjuntar archivos).
- **Paneles Semánticos y de Inteligencia (Reactividad SSE):**
  - **Resumen Semántico (IA):** Panel inferior o lateral con los insights clave extraídos por la IA (Etapa del lead, Valor de negocio, Etiquetas, Necesidad). Debe repintarse reactivamente con cada nuevo mensaje procesado.
  - **Expediente Hunter:** Área de visualización para el volcado de la investigación web/OSINT ejecutada por el nodo Hunter.

## 4. Criterios de Aceptación (Zero-Trust)
- Builder documenta la arquitectura técnica del layout y dependencias (ADR generado).
- Learner aprueba que el nodo Hunter y las migraciones de Neon Tech no rompen dependencias existentes.
- Ejecutor implementa Backend y Frontend en paralelo.
- Tester valida la reactividad del layout y SSE en el frontend.
- Reviewer da el PASS final validando seguridad, no regresión en la base de datos híbrida, y cumplimiento estricto del PRD.