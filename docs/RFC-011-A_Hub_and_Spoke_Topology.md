# RFC-011-A: Topología Hub-and-Spoke para Despliegues Single-Tenant

**Estatus:** Propuesto
**Autor:** Builder (Planificador / Arquitecto Staff)
**Proyecto:** Teseo AI CRM
**Fecha:** 18 de Abril de 2026

## 1. Topología "Hub-and-Spoke" (Definición)

En el modelo Single-Tenant del CRM, cada cliente dispondrá de un entorno de ejecución completamente aislado. Para orquestar este modelo a escala, implementaremos una topología de red y control **Hub-and-Spoke**:

*   **Hub (Centro de Control):** El Mission Control operará en un proyecto de GCP centralizado. Su responsabilidad es actuar como el panel administrativo global, gestionando la configuración de los clientes, la facturación, los dashboards globales y el enrutamiento de peticiones.
*   **Spokes (Inquilinos/Tenants):** Los orquestadores de LangGraph y los recursos computacionales específicos de cada cliente (ej. Cloud Run, bases de datos vectoriales aisladas si aplica) se desplegarán en proyectos de GCP dedicados de forma exclusiva a cada inquilino.

Esto garantiza el aislamiento de datos (Data Isolation) y recursos (Resource Isolation), fundamental para clientes corporativos o entornos de cumplimiento estricto.

## 2. Viabilidad y Seguridad en Tránsito

Al separar el panel de control central (Hub) de los orquestadores individuales (Spokes) en distintos proyectos de GCP, la comunicación entre ellos transitará inevitablemente por el internet público (o el backbone público de Google). 

**Garantía de Seguridad:**
La viabilidad técnica de este modelo se sustenta en la **capa de seguridad Server-to-Server (S2S)** desarrollada durante la Fase 1. Esta capa de autenticación, basada en **HMAC (Hash-based Message Authentication Code)** y **Bearer Tokens**, asegura que:
1.  **Autenticidad:** El orquestador Spoke verifica matemáticamente que la petición de despacho (dispatch) proviene única y exclusivamente del Mission Control (Hub).
2.  **Integridad:** La carga útil (payload) no puede ser alterada en tránsito (Man-in-the-Middle) sin invalidar la firma HMAC.
3.  **Cifrado:** Toda la comunicación ocurre exclusivamente sobre el protocolo TLS (HTTPS).

## 3. Modificación del Esquema de Base de Datos (Supabase)

Para permitir que el Mission Control (Hub) sepa a dónde dirigir la carga de trabajo de un cliente específico, el esquema global de base de datos debe ser extendido.

La tabla `tenants` en Supabase requiere la adición de los siguientes campos:

*   `orchestrator_url` (VARCHAR/TEXT, Nullable): Almacena la URL base del servicio de LangGraph (Cloud Run) desplegado en el proyecto GCP de este inquilino específico (ej. `https://langgraph-tenant-xyz-abc.a.run.app`).
*   `api_key_vault_id` (UUID, Nullable): Referencia a una tabla segura de bóveda de credenciales. Permitirá, a futuro, que cada tenant cuente con su propio secreto (shared secret) para S2S HMAC en lugar de compartir una llave global comprometedora.

## 4. Diagrama de Arquitectura (Mermaid)

```mermaid
flowchart TD
    subgraph Hub ["Hub: Proyecto GCP Central (Mission Control)"]
        UI[Mission Control UI / Next.js]
        SA[Server Actions]
        UI --> SA
    end

    subgraph DB ["Capa de Datos Central (Supabase)"]
        TenantsTable[(Tabla: tenants)]
    end

    subgraph SpokeA ["Spoke A: Proyecto GCP Tenant A"]
        OrchestratorA[LangGraph API - Tenant A\n(Cloud Run)]
    end

    subgraph SpokeB ["Spoke B: Proyecto GCP Tenant B"]
        OrchestratorB[LangGraph API - Tenant B\n(Cloud Run)]
    end

    SA -->|1. Consulta orchestrator_url| TenantsTable
    TenantsTable -.->|2. Retorna URL y credenciales| SA
    
    SA ===>|3. Dispatch: S2S Auth / HMAC sobre HTTPS| OrchestratorA
    SA ===>|4. Dispatch: S2S Auth / HMAC sobre HTTPS| OrchestratorB
```

## 5. Work Breakdown Structure (WBS) para el Ejecutor

Para implementar los cambios descritos en esta arquitectura, se asigna al Ejecutor el siguiente WBS (2 pasos requeridos):

- [ ] **Paso 1: Migración SQL en Supabase**
  - Generar el archivo de migración SQL correspondiente.
  - Añadir la columna `orchestrator_url` (tipo texto) a la tabla `tenants`.
  - Añadir la columna `api_key_vault_id` (tipo uuid o texto, según el diseño actual de secretos) a la tabla `tenants`.
  - Ejecutar la migración en los entornos de desarrollo y staging.

- [ ] **Paso 2: Actualización de la Lógica de Enrutamiento en Next.js**
  - Refactorizar el / los Server Action(s) responsables de despachar tareas al orquestador.
  - Remover la dependencia a variables de entorno globales (ej. `NEXT_PUBLIC_LANGGRAPH_URL` o `LANGGRAPH_URL`) que asumían un orquestador centralizado.
  - Modificar el controlador para que reciba el `tenant_id`, consulte el `orchestrator_url` desde Supabase, genere la firma HMAC correspondiente, y emita la solicitud POST hacia el Spoke aislado.