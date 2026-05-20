# WBS-001: Refactorización Estructural Command Center (Frontend)

## 1. Fase de Limpieza y Preparación (Clean-up)
- **1.1. Poda de Rutas:** Eliminar el directorio `app/(dashboard)/settings` (y subrutas) del repositorio `Teseo-AI-CRM`. Trasladar lógica mentalmente al Mission Control.
- **1.2. Corrección de Layout (Overflow):** Inyectar la directiva `min-h-0` en los layouts principales (`app/layout.tsx` o `app/(dashboard)/layout.tsx`) para asegurar que `<ScrollArea>` respete el viewport.
- **1.3. Instalación de Dependencias Shadcn:** Verificar/instalar componentes base necesarios: `accordion`, `scroll-area`, `tabs`, `dialog` (para el Concierge), `avatar`, `badge`.

## 2. Fase de Enrutamiento y Estado (TanStack & Next.js)
- **2.1. Estructura de Rutas:** Definir el enrutamiento para el Lienzo de Prospecto (ej. `app/(dashboard)/crm/page.tsx` para Kanban y `app/(dashboard)/crm/[leadId]/page.tsx` para el lienzo, o manejo por *search params* `?leadId=123` si se prefiere Single Page puro).
- **2.2. Configuración de Caché (Hydration):** Ajustar el `staleTime` y `gcTime` en TanStack Query para la query del Kanban, asegurando transición O(1) visual al salir del prospecto.

## 3. Fase de Componentes Estructurales (Layout & Ribbon)
- **3.1. Ribbon Contextual (`Ribbon.tsx`):**
  - Implementar contenedor superior dinámico.
  - Diseñar la máquina de estados que reciba `activeView` (Kanban | Prospecto | Odoo).
  - Renderizado condicional de botones según estado.
- **3.2. Concierge Module (`ConciergeTrigger.tsx`):**
  - Botón minimalista en el header/ribbon.
  - Modal (`<Dialog>`) con input de texto libre.
  - Función de empaquetado de payload (`tenant_id`, `user_id`, `context`) y *fetch* al endpoint interno (o webhook).

## 4. Fase del Lienzo de Prospecto (Prospect Canvas)
- **4.1. Layout Tri-Zonal (`ProspectCanvas.tsx`):**
  - Construir el contenedor Grid/Flex que asigne el 70% al centro y 30% al panel derecho, con el top reservado para el Stepper.
- **4.2. Zona Superior (Stepper):** Componente visual de etapas del embudo con capacidad de mutación (clic -> update stage).
- **4.3. Panel de Contexto (Derecha):**
  - `<Tabs>` o `<Accordion>` para separar "Atributos del Lead" y "Documentos".
  - Componentes de lectura de datos.
- **4.4. Hilo Omnicanal (Centro):**
  - Contenedor `<ScrollArea min-h-0>` para los mensajes.

## 5. Fase de Componentes de Detalle (Rich Nodes)
- **5.1. Rich Message Node (`MessageBubble.tsx`):**
  - Implementar burbuja de chat.
  - Añadir soporte para Avatar (Humano/SDR) e ícono de canal (WhatsApp, Telegram, Mail) basado en los campos `actor_type` y `source_channel`.

## 6. Integración y Pruebas
- **6.1. Ensamblaje:** Conectar el `Ribbon`, el `Kanban` y el `ProspectCanvas` al estado de TanStack.
- **6.2. Validación (Tester):** Verificar que el desbordamiento (scroll infinito) no ocurra y que las transiciones de estado mantengan la memoria del embudo.