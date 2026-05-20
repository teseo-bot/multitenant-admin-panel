# PRD: Lógica de Venta CRM & Refactor Layout

## Objetivos del Sprint
1. **Backend:** Implementar Nodo Hunter LangGraph y lógica de pipeline en Neon Tech.
   - Eliminar los mock actuales del pipeline.
   - Si un Lead tiene (nombre, teléfono, correo, necesidad), transferir a la primera columna del pipeline.
2. **Frontend:** Refactorizar Layout CRM.
   - Inbox: Botón para enviar Lead al pipeline.
   - Pipeline Board: Cards con Nombre, Canal (WA/IG/FB), Tiempo desde última interacción.
   - Kanban Operational View / Lead Detail:
     - Chat al 70% de la altura total con scroll.
     - Caja de texto de envío y barra de herramientas *fixed* debajo del chat.
     - Resumen Semántico de la IA del prospecto (debajo del chat o panel adyacente).
     - Área "Expediente / Hunter" mostrando el historial web/OSINT.
     - Reactividad (SSE/hooks) para Etapa, Valor, Etiquetas e Insights.

## Fases
1. Planificación (Generación de PRD/ADR)
2. Investigación (Exploración del repo actual)
3. Ejecución (Modificación del código)
4. Pruebas (Unit/Integración)
5. Revisión (Auditoría)
