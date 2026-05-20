# RFC_BLOQUE28_TENANT_CONFIG_FLOW: Flujo de Datos de Tenant Configs

**Estado:** Aprobado / Completado
**Autor:** Learner (Escuadrón Teseo)
**Fecha:** 24 de Abril de 2026

## 1. Objetivo y Contexto
Este reporte técnico documenta la arquitectura del flujo de datos de las configuraciones de inquilinos (`tenant_configs`), desde su persistencia en la base de datos central de Mission Control hasta su inyección en caliente dentro del Orquestador Agéntico (LangGraph).

Esta validación se realizó inspeccionando el código fuente y la documentación en la bóveda del proyecto `teseo-ai-crm` especificada en el `TOPOLOGY.json`.

## 2. Persistencia en Base de Datos (Mission Control)
La gestión de datos opera bajo un esquema Multi-Tenant en la base de datos Supabase (PostgreSQL).

- **Estructura de la Tabla:** Las configuraciones se alojan en la tabla `tenant_configs` con columnas clave como `system_prompt`, `llm_tier`, `primary_color`, `theme_mode` y un objeto `features` (JSONB) para la configuración granular.
- **Acceso y Mutación:** El frontend (Next.js) invoca endpoints como `PATCH /api/tenant/config` para realizar operaciones de tipo `upsert` filtrando por el `tenant_id` del usuario (validado mediante JWT y RLS).
- **Seguridad:** Existe una frontera estricta mediante Row Level Security (RLS) para evitar filtraciones de datos cruzadas entre inquilinos.

## 3. Integración y Sincronización con el Orquestador (LangGraph)
Para garantizar latencia ultrabaja y evitar ineficiencias causadas por consultas síncronas masivas (long-polling), el sistema implementa un modelo **Push** (Reverse Webhook).

### 3.1 Reverse Webhook y Caché (Hot Reload)
1. **Emisión (Push):** Al mutar un registro en `tenant_configs` dentro de Mission Control o vía triggers en Supabase, se dispara de forma asíncrona una petición HTTP hacia el orquestador (Cloud Run/Hono) apuntando a la ruta protegida `POST /api/internal/config`.
2. **Validación:** El webhook receptor valida las cabeceras de autorización Server-to-Server utilizando `INTERNAL_API_KEY` (alojada en Secret Manager).
3. **Caché en Memoria:** Tras validar la estructura con Zod, Hono actualiza el objeto en un almacén en memoria global (`TenantConfigCache.set(tenant_id, new_config)`).

### 3.2 Inyección Just-In-Time en `GraphState`
Para no corromper hilos (`thread_id`) en curso, la adopción del nuevo comportamiento ocurre dinámicamente en cada ciclo:
1. **Hidratación de Estado:** El nodo especializado en LangGraph (ej. `hydrate_context_node`), encargado de orquestar la preparación previa a la invocación de LLMs, interroga el `TenantConfigCache` con el `tenant_id` de la sesión activa.
2. **Inyección Dinámica:** Los nuevos parámetros (ej. `system_prompt`, reglas de BANT, llm_tier) se inyectan en el estado del grafo (`GraphState`).
3. **Ejecución en Cascada:** Los nodos ejecutores consumen la última versión de la configuración en su iteración inmediata (Hot-Reloading), habilitando la capacidad de tunear agentes de manera reactiva sin reiniciar contenedores ni truncar checkpoints.

## 4. Impacto Arquitectónico
- **Aislamiento de Lógica:** LangGraph es agnóstico a la estructura de la base de datos del Master DB.
- **Escalabilidad:** Al no estar bombardeando la DB con consultas `GET /config` en cada nodo del flujo, el CPU y la red de los contenedores se reservan exclusivamente para invocación de LLMs.
- **Resiliencia:** Si el webhook llegase a fallar, el orquestador puede optar por fallback al utilizar el `TenantConfigCache` actual hasta su expiración o mediante un reintento en el `hydrate_context_node`.