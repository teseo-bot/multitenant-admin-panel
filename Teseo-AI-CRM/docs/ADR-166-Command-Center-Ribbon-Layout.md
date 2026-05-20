# ADR-166: Arquitectura de Interfaz - Command Center (Ribbon & Prospect Canvas)

## 1. Contexto
El diseño basado en paneles laterales (`<Sheet>`) presenta severas limitaciones de espacio para la gestión de ventas consultivas omnicanal. Al intentar mostrar el historial de chat, metadatos y documentos simultáneamente, la interfaz sufre de saturación cognitiva y problemas de layout.

## 2. Decisión Arquitectónica
Se abandona el enfoque de panel lateral en favor de una **Desktop-class SPA** utilizando el patrón **Context-Aware Ribbon** y un **Lienzo de Prospecto (Prospect Canvas)** de pantalla completa.

### 2.1. El Ribbon Contextual (Máquina de Estados)
El controlador principal de la vista será un Ribbon (cinta de opciones superior) que muta dinámicamente según el contexto y la etapa del embudo.

### 2.2. Anatomía del Lienzo de Prospecto (Actualizado)
Para maximizar la altura vertical del hilo de chat (crítico para la lectura), el lienzo se divide estrictamente en dos columnas (sin barras superiores que roben espacio):
1. **Zona Central (Hilo Omnicanal - 65/70%):** `<ScrollArea>` principal (con clase `min-h-0`). 
   - Contiene los Rich Nodes y el Omnichannel Composer en el fondo.
2. **Panel de Contexto (Derecha - 30/35%):** Contenedor maestro de datos duros.
   - **Top (Fijo):** Stepper del Embudo en formato compacto (Grid/Wrap) para avanzar o retroceder el estado del lead.
   - **Cuerpo (Tabs):**
     - `Atributos`: Resumen de alto nivel, etiquetas, Insights de IA.
     - `Cliente`: Bloques colapsables (Acordeones) para Facturación, Domicilio, y campos dinámicos.
     - `Expediente`: Galería de documentos adjuntos (Cotizaciones, PDFs).

### 2.3. Preservación de Estado (Hydration)
La transición entre la vista Kanban y la vista Lienzo de Prospecto debe ser instantánea y no destructiva (TanStack Query).

## 3. Consecuencias y Siguientes Pasos
- **Aprobado:** Mejora masiva en UX. El chat gana 80px+ de altura vertical.
- **Riesgos a mitigar:** El Stepper debe rediseñarse para modo compacto, evitando desbordamientos horizontales en el panel derecho.
