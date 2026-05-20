# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-140: Bloque 18 — Cierre de Multi-Tenant Completo

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| **ID**         | ADR-140                                        |
| **Estado**     | Aprobado y Ejecutado                           |
| **Fecha**      | 2026-04-23                                     |
| **Autor**      | Builder                                        |
| **Dominio**    | Orquestador LangGraph · Seguridad Multi-Tenant |

## 1. Contexto

Como parte del Bloque 18 y el RFC-051, era necesario eliminar todos los fallbacks a `process.env.TENANT_ID` y `process.env.CAMPAIGN_ID` en el código fuente de los repositorios `Teseo-AI-CRM` y `crm-agentico-orchestrator`. Estos fallbacks representaban una vulnerabilidad grave en un entorno multi-tenant, permitiendo un potencial "cross-tenant data bleed".

## 2. Decisión

Se decidió:
1. Eliminar los fallbacks de `process.env.TENANT_ID` en `ingestion-gateway.ts` (Teseo-AI-CRM).
2. Modificar el GraphState inyectando el `tenant_id` inicial en `webhook.ts`.
3. Validar consistencia en `hydrate_context.ts` entre el `tenantId` inyectado y el proveniente de la metadata.
4. Eliminar en el nodo `gatekeeper.ts` la dependencia de `process.env` utilizando el valor de `state.tenant_id`.
5. Modificar el `webhook_dispatcher.ts` del repositorio legado `crm-agentico-orchestrator` para leer `tenantId` y `campaignId` de `GraphStateType`.
6. Añadir `campaignId` a `GraphState` del orquestador legado.
7. Depreciar las variables de entorno en el `.env.example`.
8. Introducir el middleware `dev-tenant-injector.ts` para ambientes de desarrollo locales.

## 3. Consecuencias

* **Seguridad Aumentada:** Ausencia total de fallbacks de seguridad. Cualquier petición sin el header `x-tenant-id` explícito será rechazada con 400 Bad Request en producción.
* **Trazabilidad:** El ruteador y despachador de eventos ahora dependen puramente del contexto persistido dentro de su hilo en el grafo.
* **Auditoría Finalizada:** Ejecuciones completas de `grep` confirmaron 0 resultados para `process.env.TENANT_ID` y `process.env.CAMPAIGN_ID` en los archivos TypeScript del código fuente. Los tests se actualizaron y pasan de forma correcta.
