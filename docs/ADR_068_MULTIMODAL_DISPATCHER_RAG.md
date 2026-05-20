# ADR-068: Multimodal Dispatcher, Routing RAG y CPU Throttling (Post-Mortem)

**Fecha:** 19 Abril 2026
**Estado:** Aceptado
**Proyecto:** Teseo-AI-CRM

## Contexto y Problema

Durante las pruebas y estabilización de la cimentación omnicanal (Adaptadores Web, Telegram, Email, Meta) y los procesamientos de destilación multimodal (imágenes y audios), detectamos pérdida de mensajes intermitentes y procesamiento abortado prematuramente en producción.

**El origen del fallo:**
El orquestador en `index.ts` empleaba un patrón anti-serverless conocido como *Fire-and-forget* para la emisión de respuestas y procesamiento en background. En un entorno de contenedores serverless (como Google Cloud Run) con la configuración por defecto de asignación de CPU, los ciclos de CPU se pausan o "estrangulan" (CPU Throttling) tan pronto como se retorna la respuesta HTTP al cliente. Dado que los adaptadores dependían de enviar una respuesta HTTP `200 OK` rápida (webhook acknowledge) para luego continuar con promesas flotantes, Cloud Run cortaba los ciclos del procesador abortando la ejecución en LangGraph, impidiendo que el grafo finalizara su flujo.

## Solución Adoptada

1. **Re-arquitectura de Nodos de Salida (Dispatcher Node):**
   Se eliminó el uso del patrón *Fire-and-forget* en el `index.ts`. En su lugar, se introdujo un **Dispatcher Node** explícito y síncrono al final del grafo en LangGraph. Este nodo de salida centralizado asegura el envío de los mensajes salientes (textos, binarios) y aguarda hasta su conclusión de red *antes* de que la petición original (o el worker asíncrono subyacente de `pg-boss`) se de por finalizada y permita al contenedor liberar el proceso.

2. **Enrutamiento Dinámico LLM en `gatekeeper.ts`:**
   Para manejar inteligentemente la recuperación vectorial RAG estabilizada y el procesamiento de la información, se implementó un enrutamiento LLM dinámico usando las propiedades nativas de LangGraph en el `gatekeeper.ts`. Esto permite enrutar eficientemente entre modelos (ej. Gemini Pro vs Claude) o diferentes sub-grafos dependiendo de si la tarea requiere búsqueda de alta dimensionalidad o análisis multimodal, evitando la sobrecarga en un solo prompt monolítico.

## Consecuencias

* **Positivas:** 
  * Los mensajes ya no se pierden en el limbo de CPU throttling.
  * Mejor manejo de recursos y tolerancia a fallos multimodal (fallback resiliente manejado en el Minion Worker).
  * Control total del transporte de binarios y estado omnicanal dentro del grafo de estado.
* **Negativas:** 
  * Aumento del tiempo de latencia en la petición (las respuestas tardan más en ser despachadas debido al bloqueo síncrono). Esto se mitiga ejecutando los hilos costosos mediante `pg-boss` para peticiones omnicanal, separando la confirmación de webhook (`200 OK`) de la ejecución del Minion Worker (Daemon).
