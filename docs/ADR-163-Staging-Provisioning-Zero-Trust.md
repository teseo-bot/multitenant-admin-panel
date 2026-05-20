# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR 163: Aprovisionamiento de Tenants y Fix IAM en Staging (Zero-Trust)

## Contexto y Problema
Durante la fase de Staging Deployment (Bloque 25), el pipeline de GitHub Actions hacia Cloud Run falló sistemáticamente en el paso de empuje a Artifact Registry con un error `403 Permission Denied`. Adicionalmente, una vez que la URL estuvo viva, el acceso público estaba bloqueado, y la aplicación (Command Center) no poseía entidades en base de datos, requiriendo el aprovisionamiento manual del primer Tenant para pruebas E2E.

## Decisiones Tomadas

1. **Rotación Segura de Credenciales IAM (CI/CD):**
   - **Problema:** El secreto `GCP_CREDENTIALS` en GitHub contenía una llave que no correspondía con las Service Accounts aprovisionadas.
   - **Solución:** Se regeneró la llave JSON de la cuenta `teseo-773@teseobot-487515.iam.gserviceaccount.com`, se actualizó mediante GitHub CLI y se eliminó de disco local bajo políticas de cero secretos.
   - **Efecto:** El pipeline ahora empuja exitosamente la imagen `teseo-ai-crm-panel` a Artifact Registry.

2. **Invocación Pública en Cloud Run:**
   - **Problema:** Cloud Run retornaba 403 Forbidden para usuarios externos.
   - **Solución:** Se añadió el policy binding `roles/run.invoker` a `allUsers` en el servicio `crm-frontend`.
   - **Efecto:** El DOM ahora es accesible y permite la carga del React/Next.js y la redirección hacia `/auth/login`.

3. **Aprovisionamiento Inicial del Tenant (Vía Node.js/Supabase JS):**
   - **Decisión:** En lugar de ejecutar inyecciones directas de SQL (que evaden el hash de `auth.users`), se diseñó un script Node.js transaccional.
   - **Detalle:** Se inyectó la Organización "Comerseg", con la marca "fleetco", y se generaron credenciales encriptadas para el Súper Admin del tenant (`fleetco@fleetco.mx`). El script de aprovisionamiento fue inmediatamente destruido de disco (Zero-Trust).

## Consecuencias
- El entorno de Staging está funcionalmente vivo.
- Queda pendiente la separación lógica e ingreso del Super-Admin global para Mission Control, dado que la sesión se enfocó primariamente en levantar Command Center.

