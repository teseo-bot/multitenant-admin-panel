# ADR-109: Desacoplamiento de ERP, Refinamiento de Nodos y Evolución a Tenant OS

| Campo | Valor |
|---|---|
| **ID** | ADR-109 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-19 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Arquitectura Frontend y Orquestación Multi-Agente |

## 1. Contexto y Problema
En las etapas iniciales de diseño (ADR-001, PRD-000), se acopló fuertemente la arquitectura del CRM Agéntico al ERP Odoo CE como el *Single Source of Truth* (SSOT) para todo el ciclo comercial. Además, el panel de administración carecía de módulos especializados para gestionar el ciclo de aprobación humano (Human-in-the-Loop) de las campañas y la ingesta documental. 
Por otro lado, se detectaron discrepancias en las responsabilidades de los agentes de la topología LangGraph (solapamiento entre Hunter y SDR) y duplicidad en el gestor de Prompts (Obsidian vs Supabase).

Esta rigidez impide escalar el SaaS hacia empresas que no cuentan con ERP o que poseen flujos de *Nurturing* que no deben saturar una base transaccional hasta ser concretados.

## 2. Decisiones Arquitectónicas (El Pivote Estratégico)

Se aplican las siguientes rectificaciones estructurales que sobreescriben cualquier definición anterior:

### 2.1 Desacoplamiento Transaccional (Odoo como BoFu - Bottom of the Funnel)
- **Agnosticismo de ERP:** El ecosistema operará de manera autónoma sin requerir Odoo para las fases de Prospección, Enriquecimiento y Nurturing (Top/Middle of the Funnel).
- **Gestión de Estado Base:** El motor LangGraph gestionará los leads y el pipeline de ventas *exclusivamente* en la base de datos **PostgreSQL privada del Tenant (Cloud SQL + pgvector)**, NO en Supabase (Supabase queda estrictamente para el Master DB de Mission Control: Catálogo de Tenants, Facturación y Central de Prompts).
- **Rol de Odoo:** Actúa únicamente como conector *opcional* (Add-on vía `odoo-mcp-server`) para el "Bottom of the Funnel". El LangGraph enviará datos hacia Odoo solo para emisión de cotizaciones formales, inventario y facturación final. Fleetco lo mantendrá activo por ser el Cliente 0.

### 2.2 Re-definición Limpia del Enjambre (Topología Dinámica)
Se clarifican los roles y límites de los Nodos AI para evitar colisiones:
1. **Hunter:** Radar Outbound puro. Busca señales activas de compra (Scraping, monitoreo) y empuja perfiles (leads fríos) hacia adentro del sistema.
2. **SDR (Sales Development Rep):** Es el vendedor de primera línea. Recibe los leads del Hunter o del Gatekeeper (Inbound), los califica, interactúa y los nutre.
3. **Investigador:** Nodo de soporte bajo demanda. El SDR (o Hunter) le solicita el enriquecimiento profundo de una cuenta (Estructura corporativa, noticias) antes de iniciar un acercamiento.

### 2.3 Evolución del Frontend B2B (`crm-agentico-panel` como "Tenant OS")
La interfaz que utiliza el cliente B2B deja de ser un simple visor de chat y asume el rol de Sistema Operativo del Inquilino. Se dividirá estructuralmente en tres grandes módulos asíncronos:
1. **Command Center (Inbox & Kanban):** Bandeja de Handoff (humano toma el chat de la IA) y Kanban visual ligero de ventas gestionado localmente en su PostgreSQL.
2. **Asset Studio (Ingesta Documental):** Interfaz para que el inquilino alimente el cerebro de la IA (PDFs, manuales, audios). Estos assets se envían al `crm-agentico-compiler` para poblar el RAG.
3. **Campaign Review (Estudio HITL - Human in the Loop):** Bandeja de aprobación de campañas. El *Content Creator* (IA) propone copys y activos; el humano los revisa, edita y aprueba para que el *Trafficker* (IA) ejecute la distribución.

### 2.4 Cierre de Discrepancia Documental (Supabase vs Obsidian)
- **Supabase (Mission Control):** Es el ÚNICO dueño de los *System Prompts* y parámetros de comportamiento. Teseo centraliza aquí la inyección de reglas operativas (Prompts as a Service).
- **Obsidian / TeseoKDB:** Queda deprecado como inyector de directivas de los Tenants; su uso se restringe a la gestión de conocimiento *Cold Data* de Teseo para desarrollo interno.

## 3. Consecuencias
- **Pros:** Viabiliza comercialmente el SaaS B2B como "High-Ticket" sin importar el ERP del cliente final. Justifica los costos de infraestructura Single-Tenant. Delimita un roadmap claro y modular para el Frontend con Next.js + Shadcn.
- **Riesgos:** La sincronización de estado de LangGraph hacia la base de datos PostgreSQL privada del Tenant requerirá un mapeo riguroso en el Checkpointer para que el Kanban en la UI reaccione en tiempo real.