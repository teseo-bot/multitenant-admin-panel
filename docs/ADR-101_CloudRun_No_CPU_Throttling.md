# ADR-101: Eliminación de CPU Throttling en Cloud Run para Operaciones Asíncronas (Fire-and-Forget)

| Campo | Valor |
|---|---|
| **ID** | ADR-101 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Infraestructura Cloud (Orquestador CRM-Agentico) |

## 1. Contexto y Problema
Durante la integración de canales como Telegram y WhatsApp (Meta API) con el Orquestador CRM-Agentico, se implementó el patrón *Fire-and-Forget* en el middleware del webhook. El objetivo era devolver un código HTTP `200 OK` inmediatamente a las plataformas de mensajería para evitar reintentos por Timeout, mientras LangGraph (modelo, embeddings y checkpointer) procesaba la respuesta asíncronamente en segundo plano.

A pesar de esta arquitectura en código, los bots presentaban una **latencia inaceptable (30 a 50 segundos de delay)** y en muchas ocasiones sufrían **Crash Loops silenciosos (Modo Eco)** donde el bot solo repetía el último mensaje del usuario.

## 2. Diagnóstico de la Causa Raíz
Se determinó que el problema no radicaba en el código fuente de Node.js/Hono, sino en el **modelo de asignación de recursos Serverless de Google Cloud Run**.

Por defecto, Cloud Run asigna CPU a un contenedor **únicamente durante el procesamiento de una solicitud HTTP activa**. En cuanto el Orquestador devolvía la respuesta HTTP `200 OK` a Telegram/WhatsApp, Google Cloud "estrangulaba" (throttling) la CPU del contenedor casi a cero hertzios. 

Consecuentemente, el proceso asíncrono de LangGraph (`workflowApp.invoke(...)`), que se estaba ejecutando en el background de Node.js para analizar el mensaje, invocar herramientas y consultar PgVector, sufría inanición de procesamiento. Esto causaba latencias extremas y, con frecuencia, colapsos por timeouts internos que derivaban en respuestas vacías (las causantes del "Modo Eco").

## 3. Decisión
Desactivar el estrangulamiento de CPU en el despliegue del Orquestador mediante la bandera de asignación continua de recursos.

1. **Modificación del Pipeline IaC:** Se inyecta la directiva `--no-cpu-throttling` (equivalente a "CPU always allocated") en el script de despliegue (`deploy-orchestrator.sh`) y en las plantillas de `cloudrun.yaml`.
2. **Mitigación del Modo Eco:** Se refuerzan los nodos del grafo (`rag.ts`, `sdr.ts`) con bloques `try-catch` robustos. Si el LLM o el Tool Calling experimentan un timeout de red o rate-limit (429), el nodo generará un mensaje amigable de fallback (*"Disculpa, estoy experimentando un fallo de conexión temporal..."*) en lugar de devolver un historial vacío que provoque el eco del mensaje de entrada.

## 4. Consecuencias y Siguientes Pasos
- **Pros:** El procesamiento asíncrono en background de LangGraph opera a máxima velocidad (CPU completa). Se elimina el delay de respuesta en los canales de mensajería y se previene el comportamiento del "Modo Eco".
- **Contras (FinOps):** Mantener el "CPU Always Allocated" cambia el modelo de cobro de Cloud Run. El cliente (Single-Tenant) pagará por la vida útil del contenedor entero mientras esté encendido, no solo por la duración milisegundo a milisegundo de las peticiones HTTP.
- **Acción Táctica:** Documentar este cambio en las plantillas comerciales del SaaS, ya que incrementará marginalmente el costo base de infraestructura mensual que asume el cliente B2B (estimado ~$15-30 USD extra al mes en GCP por contenedor activo).
