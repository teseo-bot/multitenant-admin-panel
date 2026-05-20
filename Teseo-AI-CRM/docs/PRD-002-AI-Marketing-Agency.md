# PRD-002: Agency-in-a-Box (Teseo CRM-Agentico B2B)

## 1. Visión General
Teseo está evolucionando de ser un CRM B2B pasivo —enfocado únicamente en el almacenamiento y visualización estática de datos— a un sistema activo, autónomo e impulsado por inteligencia artificial, denominado **"Agency-in-a-box"**. Esta transformación permitirá al CRM no solo registrar el estado de la empresa, sino operar proactivamente como una agencia de marketing interna completa, ejecutando estrategias, generando contenidos y cerrando ventas.

## 2. The Knowledge Layer (Recolección Pasiva)
La inteligencia de los agentes depende de una ingesta de datos constante, silenciosa y escalable. Para lograrlo, implementaremos el **Knowledge Layer**.

*   **GBrain Minions:** Servicios de integración y extracción continua para la ingesta asíncrona masiva de datos.
*   **Costo y Durabilidad:** Arquitectura diseñada para operar con $0 tokens en la etapa de ingesta cruda, siendo un proceso background de alta durabilidad (sin los timeouts clásicos de APIs síncronas de LLMs).
*   **Fuentes de Datos:** Ingestión de silos de información empresariales, capturando el "pulso" real del negocio desde plataformas como **Slack, Odoo, Zoom**, correos y CRMs satélite.

## 3. Líneas de Investigación Tecnológica

El desarrollo del Agency-in-a-box requiere ejecutar R&D profundo en los siguientes pilares fundamentales:

### 3.1. Multi-Agent Collaboration
Implementación de flujos de trabajo estructurados y profesionales.
*   **Inspiración:** Basado en el rigor de `pro-workflow` (correcciones persistentes, *quality gates*, roles aislados), y en los patrones de framework probados de **MetaGPT** y **AutoGen**.
*   **Ecosistema de Agentes Especialistas:**
    *   *Media Buyer:* Análisis de pauta, asignación de presupuestos y optimización de campañas.
    *   *Proposal Agent:* Creación de cotizaciones y propuestas comerciales altamente personalizadas usando el histórico del cliente.
    *   *Content Agent:* Generador de copy y contenido publicitario.
    *   *Reporting Agent:* Sintetizador de métricas que reporta directamente al humano en el bucle.

### 3.2. GraphRAG & Búsqueda Semántica
Transición de RAG plano a arquitecturas basadas en grafos.
*   **Mecanismo:** Estructuración de datos complejos y dispares en grafos de conocimiento.
*   **Objetivo:** Permitir a los agentes "conectar los puntos" y correlacionar insights semánticos (ej. vincular la queja de un cliente en un ticket con un lote de producción defectuoso registrado en Odoo), elevando el nivel de análisis y razonamiento del sistema.

### 3.3. Context Holding (Memoria a Largo Plazo)
Gestión eficiente del límite de tokens sin pérdida de identidad.
*   **Inspiración:** **MemGPT** (arquitecturas de paginación de memoria y auto-edición de almacenamiento a largo plazo).
*   **Objetivo:** Los agentes deben recordar el "brand voice" del cliente, las reglas de negocio, diccionarios de marca y preferencias por años, inyectando al contexto activo solo la información relevante sin saturarlo ni incurrir en sobrecostos masivos.

### 3.4. Continuous Learning
Sistemas de retroalimentación autónoma donde el sistema aprende de sus victorias y fracasos.
*   **Inspiración:** **Voyager** (descubrimiento iterativo) y bucles de corrección de repositorios tipo `pro-workflow`.
*   **Objetivo:** Los agentes evaluarán las campañas o outputs, retroalimentarán los "prompts ganadores" y las "correcciones del usuario" directamente al sistema principal. El resultado es un CRM que, mes a mes, requiere menos instrucciones y comete cero errores repetidos.
