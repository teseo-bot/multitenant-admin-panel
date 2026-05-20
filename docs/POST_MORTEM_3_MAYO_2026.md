# Post-Mortem 3 Mayo 2026: Caídas SSE y WhatsApp M2M

## 1. Problema Principal (HTTP 400 en SSE)
- **Síntoma:** El CRM arrojaba HTTP 400 por falta de `tenant_id` en las conexiones SSE.
- **Causa Raíz:** Las conexiones `EventSource` no envían cabeceras personalizadas (`Authorization`), solo cookies. Las rutas asíncronas estaban intentando buscar el `tenant_id` exclusivamente en los metadatos.
- **Resolución:** Implementación de `lib/auth/get-tenant-context.ts` en `Teseo-AI-CRM`.

## 2. Problema Secundario (HTTP 404 en WhatsApp/Telegram)
- **Síntoma:** Cloud Run reportaba errores 404 al intentar despachar eventos desde el Orquestador al CRM a través de `TENANT_OS_URL`.
- **Causa Raíz:** El script de despliegue del orquestador (`deploy-cloudrun.sh`) inyectaba una `TENANT_OS_URL` estática apuntando a `crm-mission-control` (panel admin) en lugar de `crm-frontend`.
- **Resolución:** Refactorización del script de despliegue y variables de entorno para apuntar al inquilino correcto (`crm-frontend-1067632954359`).

## 3. Falla Estructural de Red en GCP (ETIMEDOUT y Amnesia LangGraph)
- **Síntoma:** `crm-frontend` colapsó con `ETIMEDOUT 172.18.208.3:5432`. El Orquestador no guardaba la memoria y fallaba en los Healthchecks de despliegue al conectarse a la Base de Datos.
- **Causa Raíz:** Una divergencia en la configuración de *Direct VPC Egress* en Cloud Run:
  1. El secreto `DATABASE_URL` contenía la IP Privada de Cloud SQL (`172.18.208.3`).
  2. `crm-agentico-orchestrator` tenía VPC Egress configurado, por lo que podía leer y escribir memoria.
  3. `crm-frontend` **no** tenía VPC Egress configurado. Al desplegarse hoy, intentó buscar `172.18.208.3` a través de Internet público, resultando en un colapso en el Inbox y colas.
  4. Al intentar regresar el secreto a la IP Pública (`104.197.190.12`), el Orquestador colapsó, ya que Cloud SQL bloquea conexiones públicas externas (solo la IP de tu casa, `189.128.247.154`, está en la *allowlist*).
- **Resolución Arquitectónica (Zero-Trust):** 
  Se revirtió `DATABASE_URL` a la IP privada de Cloud SQL (`172.18.208.3`) para garantizar seguridad de perímetro. Acto seguido, se habilitó la bandera `--vpc-egress private-ranges-only` en el contenedor de `crm-frontend`. Ambos servicios ahora comparten la misma VPC privada.
