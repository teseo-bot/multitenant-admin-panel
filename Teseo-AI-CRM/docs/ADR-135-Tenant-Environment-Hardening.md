# ADR-135: Hardening de Entorno y Arquitectura Dinámica del Tenant OS

**Fecha:** 2026-04-22
**Estado:** Aprobado
**Autor:** Builder (Arquitecto Staff)

## 1. Contexto

Durante la certificación del "Bloque 6: Headless Rendering Engine" para Google Cloud Run, se identificaron fugas críticas de diseño y deudas técnicas que bloquean las pruebas en producción:

1. **Rutas Hardcodeadas:** Existencia de cadenas como `http://localhost:3000` en la lógica de Backend (específicamente en la API de Playwright para resolver la URL del renderizado Headless). Esto provoca fallos de resolución DNS en entornos Serverless.
2. **Dependencia de Datos Estáticos (Genéricos):** El *seed* de la base de datos inyecta *prompts* estáticos que no representan la realidad multi-tenant, contaminando el ambiente de QA con datos de prueba genéricos.
3. **Módulos Faltantes Identificados:** El CEO identificó la ausencia de los módulos "Alertas", "FinOps" (Costos) y el "Dashboard Analítico". Estos no estaban programados en el *Asset Studio*, pero son requerimientos irrenunciables para el Core del *Mission Control*.

## 2. Decisiones Arquitectónicas

### 2.1. Política Cero-Localhost (Dinamic Host Resolution)
Todo endpoint o proceso de servidor que requiera auto-llamarse o referenciar el dominio principal (como el *Headless Engine* o el *Webhooks Callback*) debe deducir la URL de forma absoluta desde su propio contexto.

- **Frontend (Browser):** Utilizar rutas relativas (e.g., `/api/asset-studio/snapshots`).
- **Backend (Server/API):** Utilizar inyección explícita a través de variables de entorno de producción (`NEXT_PUBLIC_APP_URL`) gestionadas por Google Secret Manager. Como *fallback*, se extraerá el host dinámicamente de la solicitud (`req.headers.get('host')`) validando contra el protocolo originario.

### 2.2. Aislamiento Multi-Tenant de Prompts y Variables
La tabla de plantillas y datos predeterminados no debe tener dependencias genéricas. Si la tabla pertenece a un "Tenant", la inyección de la semilla de datos inicial ocurrirá *just-in-time* al momento de aprovisionar (onboarding) la organización, no durante el despliegue de infraestructura. Las pruebas QA requerirán la creación manual (o vía script) de un entorno limpio para un Tenant específico.

### 2.3. Definición del Bloque 8: FinOps y Telemetría Central
Para cubrir los requerimientos operativos faltantes, se abre formalmente la arquitectura para el **Bloque 8**.

- **Alertas (Andon):** Basado en Server-Sent Events (SSE) y el enrutador de capacidades, enfocado en mostrar umbrales críticos de uso, desconexiones de agentes y errores fatales del *Event Bridge*.
- **FinOps (Control de Costos):** Implementación de una tabla agregada en Supabase que calcule tokens consumidos (Input/Output) cruzados con los modelos seleccionados (Gemini, Claude, Ollama) y emitirá reportes de facturación por Tenant.
- **Dashboard Principal:** Rediseño del `/(dashboard)/page.tsx` para que consuma un *Facade Pattern* unificando: Tasa de Resolución (IA), Volumen de *Leads* y Gasto Financiero, reemplazando las páginas vacías o plantillas por defecto.

## 3. Consecuencias (Siguientes Pasos Ejecutivos)

1. El Agente Ejecutor debe realizar un barrido (grep) del código para sustituir los `localhost` por resoluciones dinámicas.
2. Modificar el endpoint de generación de Snapshots asíncronos para acatar la política de dominio dinámico.
3. Se pausarán las pruebas de los submódulos faltantes (FinOps/Alertas) hasta que su propio *WBS* y asignación de Sprint estén definidos en una sesión posterior.
