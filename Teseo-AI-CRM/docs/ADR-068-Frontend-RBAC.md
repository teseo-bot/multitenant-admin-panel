# ADR-068: Implementación de Controles de Acceso (RBAC) en Frontend y Middlewares Seguros

## Estado
Aprobado/PASS (Auditado el 25 de Abril de 2026)

## Contexto
El sistema requería la implementación de controles de acceso basados en roles (RBAC) en el frontend para restringir el acceso a vistas, layouts y opciones de navegación (Sidebar). Previamente existía una dependencia en `user_metadata` que era propensa a desincronizaciones y se detectaron vulnerabilidades (CWE-798) por el uso de credenciales directamente en código y bucles de redirección en las rutas protegidas.

## Decisión
Se implementó una arquitectura de control de accesos consultando directamente la base de datos como Fuente Única de Verdad (SSOT):

1. **SSOT con `tenant_users`**: Se abandonó el uso de `user_metadata` desde el cliente para determinar roles. El rol ahora se obtiene en tiempo de servidor con una consulta asíncrona y directa a la tabla `tenant_users`.
2. **Middlewares y Variables de Entorno Seguras**: Se refactorizó `utils/supabase/middleware.ts` para mitigar definitivamente la vulnerabilidad CWE-798 (eliminando credenciales hardcodeadas). Ahora depende estrictamente de las variables de entorno. Además, se sanearon las reglas de redirección de autenticación.
3. **Validación en Server Components (Guards)**: Se creó una función unificada y centralizada (`enforceRoleAccess` en `utils/server/rbac.ts`) que evalúa los roles del usuario contra listas de roles permitidos e invoca `redirect('/unauthorized')` antes de la renderización en caso de falta de privilegios.
4. **UI Condicional**: Los menús de la aplicación se alimentan del rol verificado para hidratar de forma asíncrona el `AppSidebar`, ocultando por defecto ítems administrativos para roles como `member`.

## Consecuencias
- **Seguridad Sólida:** Las comprobaciones se hacen del lado del servidor asegurando que ninguna manipulación en el cliente otorgue acceso a layouts bloqueados. Las vulnerabilidades CWE-798 fueron resueltas.
- **Coherencia y Centralización:** Aplicación estricta de principios SRP y DRY. La lógica de RBAC no se repite; la interfaz solo consume las decisiones de acceso sin calcularlas.
- **Estabilidad de Tipos:** Los refactors mantuvieron el cumplimiento absoluto de tipos de TypeScript (Validación QA pasada).
