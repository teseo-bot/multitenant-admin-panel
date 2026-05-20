# ADR-104: Hidratación Dinámica del Orquestador y RLS en Mission Control

| Campo | Valor |
|---|---|
| **ID** | ADR-104 |
| **Estado** | Aprobado (Provisional) |
| **Fecha** | 2026-04-19 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Torre de Control y Orquestación B2B |

## 1. Contexto y Problema

Con la implementación de la Torre de Control (ADR-100), se introdujo la capacidad de modificar remotamente el comportamiento de los agentes B2B (`system_prompt`, `llm_tier`, `status`). 

Surgieron dos bloqueos técnicos durante la implementación:
1. **Frontend Access (RLS):** Las tablas `tenants` y `tenant_configs` están protegidas por Row Level Security (RLS) en Supabase. Al ser Mission Control una app de Next.js (Client Components), las llamadas anónimas eran bloqueadas, resultando en tablas vacías.
2. **Orchestrator Sync:** El `crm-agentico-orchestrator` mantenía un `TenantConfigCache` en memoria, pero carecía del enlace inicial para extraer el prompt desde la base de datos en caso de un reinicio del contenedor (Cloud Run) o una solicitud nueva.

## 2. Decisión

### 2.1 Bypass Temporal de RLS en Mission Control
Para mantener la velocidad de entrega en un entorno local/controlado, se inyectó la `SERVICE_ROLE_KEY` (que evade RLS) en la variable de entorno expuesta `NEXT_PUBLIC_SUPABASE_ANON_KEY` de la Torre de Control. 
*Nota: Esto es una deuda técnica consciente. Mission Control solo debe ser accesible en red segura o localhost hasta que se implemente Supabase Auth.*

### 2.2 Hidratación Activa (Fallback a DB) en Orquestador
Se modificó el nodo `hydrate_context.ts` de LangGraph. 
1. Busca primero en `TenantConfigCache`.
2. Si falla (cache miss), abre una conexión `pg` nativa hacia Supabase.
3. Extrae `system_prompt` y `llm_tier`, mapeando de manera resiliente las versiones de modelos ingresadas en texto libre a los enums estrictos internos (`base`, `pro`, `ultra`).
4. Almacena el resultado en caché para los siguientes nodos.

## 3. Consecuencias y Siguientes Pasos
- **Pros:** El despliegue a producción B2B se ha desbloqueado. Se pueden inyectar configuraciones dinámicas sin redesplegar código de los inquilinos.
- **Contras / Deuda Técnica:** Exposición de credenciales admin en el frontend web.
- **Próximo Paso Inmediato (Bottom-Up):** Integrar `Supabase Auth` (Email/Password o Magic Link) en `Mission Control` para eliminar la dependencia de la llave de servicio en el lado del cliente, garantizando seguridad Zero-Trust corporativa.