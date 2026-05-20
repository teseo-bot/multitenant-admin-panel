# ADR-132: Enlace de Mission Control con Entorno Supabase Cloud y Seed Inicial

**Estado:** Aprobado
**Fecha:** 21 Abril 2026

## Contexto
Durante las pruebas de aceptación física (UAT), se detectó que la instancia de Mission Control desplegada en GCP Cloud Run estaba configurada con variables dummy (`localhost:54321`) heredadas de las pruebas E2E de Playwright en entorno Sandbox. Esto provocaba un bloqueo arquitectónico total al intentar autenticar usuarios humanos desde internet, resultando en un error silenciado en la UI y fallos de conexión en red.

## Decisión Técnica
1. **Migración a Entorno Real (Cloud):** Se reemplaza la inyección de variables locales por credenciales vinculadas a un proyecto de Supabase alojado en la nube (Staging/Production).
2. **Topología de Cuentas (Seed Inicial):** Se establece la configuración base de la plataforma MultiTenant con las siguientes identidades:
   - **Super Admin (Tenant OS / Mission Control):** `jorge@teseo.lat`
   - **Tenant Inicial (Proyecto 0):** `Fleetco`
   - **Operador de Tenant:** `fleetco@fleetco.mx`

## Consecuencias
- El contenedor de Cloud Run deberá actualizarse vía `gcloud run services update` inyectando la `NEXT_PUBLIC_SUPABASE_URL` y la `NEXT_PUBLIC_SUPABASE_ANON_KEY` reales.
- Las cuentas `jorge@teseo.lat` y `fleetco@fleetco.mx` deberán ser aprovisionadas manualmente en el panel de Supabase Auth antes de reiniciar las pruebas de UAT (Paso 1.1).
- Se rompe la dependencia del entorno de desarrollo local para validaciones QA, acercando la arquitectura al paso final hacia Producción.
