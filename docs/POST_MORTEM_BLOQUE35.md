# Post-Mortem y Decisiones Arquitectónicas (Bloque 35)

## Fecha: 26 de Abril de 2026

### 1. Incidencias y Resoluciones
- **Falla en Pipeline Cloud Build (Multi-Container Sidecar):** El Orquestador y Obscura requerían el uso de `gcloud run services replace service.yaml`. Esto falló inicialmente debido a que la cuenta de servicio de despliegue (`fleetco-sdr-workspace`) no tenía los permisos `roles/run.admin` ni `roles/iam.serviceAccountUser` para hacer "actAs" sobre la cuenta de cómputo por defecto. Se resolvió mediante despliegue manual directo (bypass del pipeline).
- **Caída de SSR por Fallo de Supabase:** Se identificó que la falta de variables de entorno de Supabase en tiempo de compilación/runtime causaba un Error 500 total en el `layout.tsx`. Se implementaron bloques `try/catch` para hacer un fallback silencioso a estilos base.
- **Merge Hell de Tailwind v4:** Intentar forzar Tailwind v4 y directivas `@theme` sobre un stack de Shadcn viejo causaba rotura de animaciones y dependencias. Se aplicó "Rollback Arquitectónico", manteniendo TW v3, pero refactorizando el estado interno para inyectar `oklch()` mediante componentes declarativos (`<TenantThemeStyle />`) sin mutar imperativamente el DOM.

### 2. Estandarización
- El formato `oklch()` es ahora el único estándar admitido en la base de datos de Tenants.
- Las UI de `teseo-mission-control` (Admin) y `crm-agentico-panel` (Command Center Cliente) están sincronizadas con validaciones estrictas `zod` sobre las regex de formato `oklch`.

### 3. Próximos pasos
- Automatizar el CI/CD resolviendo el IAM lock de Cloud Build para que los deployments no dependan de la terminal local del M1.
