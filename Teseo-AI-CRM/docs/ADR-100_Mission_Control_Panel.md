# ADR-100: Teseo Mission Control (Torre de Control B2B Multitenant)

| Campo | Valor |
|---|---|
| **ID** | ADR-100 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Panel de Control Interno (SaaS B2B) |

## 1. Contexto y Problema

Tras adoptar el modelo **Single-Tenant** (ADR-097), cada cliente (ej. Fleetco, Innoteca, T4Oligo) cuenta con infraestructura dedicada y aislada en GCP (Cloud Run, PostgreSQL Vectorial, Odoo, WhatsApp Webhooks).
Esto resuelve problemas de seguridad y FinOps, pero introduce una complejidad operativa inmanejable para Teseo:
1. **Despliegue Manual Lento:** Clonar repositorios, crear proyectos GCP, inyectar secretos y configurar webhooks a mano toma horas por cliente.
2. **Ceguera Operativa:** El Agente de Soporte L1 (ADR-099) y el Router FinOps (ADR-098) envían métricas y alertas, pero carecen de un *Dashboard* visual donde el equipo de DevOps pueda agruparlas por cliente.
3. **Mantenimiento Distribuido:** Modificar un *System Prompt* o la agresividad de venta del bot (Temperature) de un cliente implica hacer un *redeploy* manual o editar archivos `.env` en cada proyecto aislado de GCP.

## 2. Decisión

Construir **`Teseo Mission Control`**, un Panel de Control Administrativo centralizado que actuará como la Torre de Control para todos los despliegues Single-Tenant del SaaS B2B.

### 2.1 Pila Tecnológica
- **Frontend/Backend:** Next.js (App Router), React, Shadcn/UI y Tailwind CSS.
- **Base de Datos Central:** PostgreSQL (Vía Supabase) para almacenar el catálogo de clientes, sus configuraciones, historial de FinOps y Webhooks.

### 2.2 Módulos Críticos de la Torre de Control

#### 2.2.1 Onboarding B2B (Despliegue de 1-Click)
- **Función:** Panel donde el CEO ingresa los datos del nuevo cliente (Nombre, API Keys de LLMs proporcionadas por el cliente, credenciales de su Odoo).
- **Acción:** El Panel dispara un *Pipeline de Infraestructura como Código (IaC)* en background que clona el monorepo `Teseo-AI-CRM`, crea el proyecto GCP para el cliente, levanta el Cloud Run y configura el PgVector en menos de 10 minutos.

#### 2.2.2 Dashboard FinOps y Kill-Switch
- **Función:** Visualización centralizada del consumo diario de tokens y costos por Tenant (alimentado por los pings del `llm-router.ts`).
- **Acción:** Si el cliente incumple el pago de la suscripción SaaS, el Panel cuenta con un **"Kill-Switch"** que altera el estado del Tenant en Supabase. El bot del cliente consulta este estado antes de responder (o el Panel inyecta un cambio en el servicio Cloud Run) para detener operaciones sin borrar la base de datos vectorial del cliente.

#### 2.2.3 Hub de Alertas (Support L1)
- **Función:** Recepción nativa de los Webhooks de Emergencia enviados por el Agente L1.
- **Visualización:** Tabla roja de alertas en tiempo real (ej: `[Innoteca] [10:32 AM] [Timeout Odoo. Lead afectado: +521234567]`). 
- **Acción:** Posibilidad de escalar la alerta a Telegram o asignar un ticket a un ingeniero de Teseo.

#### 2.2.4 Configuración Dinámica Remota (Dynamic Prompts)
- **Función:** El Panel permite editar los Prompts del Sistema (Gatekeeper, SDR, Inbound) y variables finas (Temperature) de cada cliente desde una interfaz visual.
- **Mecanismo:** El Orquestador de Cloud Run de cada cliente consumirá estos prompts vía `GET` al Panel Teseo (con caché en memoria) en lugar de tenerlos *hardcodeados* en su código. Cambiar el tono del bot ya no requerirá hacer *deploy* a GCP.

## 3. Consecuencias y Siguientes Pasos
- **Pros:** Transforma a Teseo de una "Agencia de Software" a un **SaaS Altamente Escalable**. Reduce el tiempo de Onboarding de horas a minutos. Mantiene la seguridad Single-Tenant ofreciendo facilidad de gestión Multi-Tenant.
- **Contras:** Incrementa la carga de desarrollo inicial para el equipo de Teseo (se debe construir un nuevo proyecto Next.js desde cero).
- **Acción Táctica:** El Agente Builder debe inicializar el proyecto `teseo-mission-control` con Next.js + Shadcn/UI e implementar la primera pantalla del catálogo de Tenants y el Dashboard de recepción del Agente L1.
