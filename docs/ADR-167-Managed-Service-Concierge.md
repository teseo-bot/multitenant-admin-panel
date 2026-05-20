# ADR-167: Arquitectura "Managed Service" y Módulo Concierge

## 1. Contexto y Decisión de Negocio
Teseo-AI-CRM opera bajo un modelo de negocio B2B *High-Ticket* (Servicio Gestionado / Concierge). Exponer herramientas de configuración técnica compleja al cliente final degrada la percepción de valor, expone la Propiedad Intelectual (Prompts de IA) y aumenta drásticamente el riesgo de fallos en el sistema por errores de usuario en credenciales de APIs (WhatsApp, Webhooks).

## 2. Decisiones Arquitectónicas

### 2.1. Eliminación del Módulo "Settings" en el Frontend Cliente
Se **prohíbe estrictamente** la implementación de un módulo de configuración general en el Command Center. 
El Command Center será 100% operativo.
**Funciones eliminadas y delegadas al Mission Control (Staff Teseo):**
- Gestión de Branding (Logos, Paletas, CSS).
- Configuración y ajuste fino de Prompts de IA.
- Gestión de conexiones API y Webhooks (Meta, Odoo).
- Alta/Baja de usuarios y asignación de roles.

### 2.2. Implementación del Patrón "Concierge Payload Emitter"
Para soportar este modelo sin requerir un sistema de soporte burocrático, se implementará un componente ligero llamado **Concierge**.
- **Regla de UX:** Cero fricción. Prohibido el uso de la palabra "Ticket".
- **Mecánica:** Un formulario de entrada simple (Input de texto + Categoría).
- **Enriquecimiento Transparente:** Al enviar la solicitud, el frontend adjuntará silenciosamente la metadata crítica (`tenant_id`, `user_id`, consumo actual de tokens, vista activa).
- **Destino:** El payload será inyectado directamente en el Mission Control (y notificado vía webhook interno), donde el staff de Teseo lo procesará con herramientas de administración reales, protegiendo al cliente de interfaces complejas.

## 3. Consecuencias
- **Reducción de Deuda Técnica:** Disminuye dramáticamente la carga de trabajo en el frontend del cliente al no requerir flujos de validación complejos para configuraciones.
- **Protección de FinOps:** Las solicitudes de escalamiento (más usuarios, más documentos indexados) pasarán obligatoriamente por revisión humana en el Mission Control, previniendo abusos de infraestructura y abriendo oportunidades de *Upsell*.
