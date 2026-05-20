# POST MORTEM - Bloque 28: Orquestación LangGraph, Webhooks y Estabilización

**Fecha:** 24 Abril 2026
**Autor:** Teseo (Builder)
**Contexto:** Cierre del Sprint 28 y estabilización del motor agéntico.

## 🎯 Resumen de Hotfixes y Estabilización

Durante el Bloque 28, se implementaron 4 hotfixes críticos para estabilizar la orquestación LangGraph, el procesamiento de webhooks y la delegación de permisos a nivel de dominio:

### A) Fix del Efecto Eco
- **Problema:** Los webhooks estaban procesando mensajes duplicados o rebotados debido a la falta de validación del último estado del canal.
- **Solución:** Se implementó una validación estricta de `lastMessage` directamente en la capa del webhook para asegurar la idempotencia y descartar mensajes redundantes antes de invocar el motor agéntico.

### B) Refactor Asíncrono para Cloud Run
- **Problema:** Se presentaban timeouts prematuros en Cloud Run porque los procesos de orquestación excedían el límite de respuesta de las peticiones síncronas bajo carga pesada.
- **Solución:** Refactorización del procesamiento hacia un modelo asíncrono. Ahora el webhook retorna un 200 OK de inmediato, delegando el trabajo pesado a procesos en background o manejadores de tareas desacoplados, previniendo así las caídas y cierres de conexión de Cloud Run.

### C) Integración Estricta de ToolNode para Function Calling de Gemini
- **Problema:** Fallas en la invocación de herramientas o alucinaciones en el parseo de argumentos.
- **Solución:** Reforzamiento y tipado estricto del `ToolNode` en el StateGraph de LangGraph, forzando un acoplamiento puro con las capacidades nativas de Function Calling de Gemini. Esto asegura que los esquemas de las herramientas se mapeen de forma determinista antes de la ejecución.

### D) Inyección de Workspace Service Account en Secret Manager
- **Problema:** Limitaciones de autenticación para realizar operaciones que requerían privilegios de administración en el Workspace del tenant.
- **Solución:** Configuración e inyección segura de la Service Account de Google Workspace dentro de GCP Secret Manager. Habilitación de Domain-Wide Delegation para permitir que el agente principal actúe con permisos granulares (calendarios, emails) bajo los scopes del dominio sin requerir OAuth interactivo por cada usuario final.

### E) Error de validación de llamadas a herramientas (GoogleGenerativeAIFetchError: Bad Request 400)
- **Problema:** Origen en un historial asimétrico de mensajes causado por fallos previos en la autorización OAuth de Google Workspace.
- **Solución:** Acciones tomadas: Purga de hilos asimétricos y validación de Scopes en Workspace.

## 🚀 Siguientes Pasos
El sistema se encuentra estable para dar inicio al **Bloque 29**: Implementación de Tenant-Channel Mapping Dinámico, basado en la arquitectura definida en `RFC_TENANT_CHANNEL_MAPPING.md`.
