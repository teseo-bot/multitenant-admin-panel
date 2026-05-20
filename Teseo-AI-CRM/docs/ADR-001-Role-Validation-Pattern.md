# ADR-001: Patrón de Validación de Roles en Endpoints Privilegiados

- **Estado:** Aceptado
- **Fecha:** 2026-04-20
- **Autor:** Builder (Arquitecto de Software Principal)
- **Aprobado por:** Reviewer (Auditor) — PASS final del ciclo Campaign Review

---

## Contexto

El CRM de Teseo AI expone endpoints privilegiados (ej. Campaign Review, gestión de usuarios, configuración de campañas) que requieren verificar el rol del usuario antes de ejecutar operaciones sensibles.

Existen dos enfoques posibles para obtener el rol del usuario autenticado:

1. **Claims del JWT del cliente:** Leer el `role` desde los custom claims incluidos en el token JWT que Supabase Auth emite al cliente. Este enfoque es rápido pero **inseguro**: los claims se firman al momento del login y pueden estar desactualizados si el rol cambió después de la emisión del token (revocación tardía). Además, dependen de la configuración correcta de hooks de Auth, lo cual añade superficie de ataque.

2. **Admin-client role fetch:** Consultar el campo `role` directamente desde la tabla `user_profiles` usando el cliente `supabaseAdmin` (service_role key) en el servidor. Este enfoque garantiza que el rol refleje el estado **actual** de la base de datos en el momento exacto de la petición.

Durante la implementación del módulo Campaign Review, el Reviewer identificó que el patrón seguro (opción 2) debía estandarizarse para todo endpoint privilegiado del CRM, eliminando ambigüedad en futuras implementaciones.

## Decisión

**Se adopta el patrón `admin-client role fetch` como estándar oficial** para la validación de roles en todos los endpoints privilegiados del CRM.

### Especificación del Patrón

| Aspecto | Definición |
|---------|-----------|
| **Fuente de verdad** | Tabla `user_profiles`, columna `role` |
| **Cliente de acceso** | `supabaseAdmin` (service_role key, server-side only) |
| **Momento de consulta** | En cada request al endpoint privilegiado (sin cache de rol) |
| **Identificador del usuario** | `user.id` extraído del JWT autenticado (solo para identificar, NO para autorizar) |
| **Scope** | Todo endpoint que requiera `role === 'admin'` o cualquier nivel de privilegio elevado |

### Lo que NO se debe hacer

- ❌ Leer el rol desde `jwt.claims` o `jwt.app_metadata` para decisiones de autorización.
- ❌ Cachear el rol del usuario entre requests en memoria del servidor.
- ❌ Usar el cliente anónimo (`supabase` client-side) para consultar roles.
- ❌ Confiar en RLS (Row Level Security) como único mecanismo de autorización para operaciones administrativas.

## Consecuencias

### Positivas

- **Seguridad reforzada:** El rol siempre refleja el estado actual de la BD, eliminando ventanas de tiempo donde un usuario revocado mantiene acceso.
- **Consistencia:** Un único patrón para todo el equipo. Cualquier Ejecutor sabe exactamente cómo implementar la validación de roles sin ambigüedad.
- **Auditabilidad:** Al centralizar la fuente de verdad en `user_profiles`, los cambios de rol quedan trazables en un solo lugar.
- **Independencia de Auth hooks:** No se depende de la correcta configuración de custom claims en Supabase Auth.

### Negativas

- **Latencia marginal:** Cada request privilegiado ejecuta un query adicional a `user_profiles`. Impacto mínimo (~2-5ms) dado que es una lectura por primary key con índice.
- **Dependencia del service_role key:** Requiere que los endpoints server-side tengan acceso seguro a la `SUPABASE_SERVICE_ROLE_KEY`. Esto ya es estándar en la arquitectura actual (Next.js API routes / Server Actions).

### Neutrales

- Este ADR no aplica a endpoints públicos o de solo lectura que no requieren privilegios elevados.
- La autenticación (verificar que el usuario es quien dice ser) sigue delegada al JWT de Supabase Auth. Este ADR solo gobierna la **autorización** (verificar qué puede hacer).

---

## Referencias

- Módulo origen: Campaign Review (ciclo PASS — Abril 2026)
- Tabla: `user_profiles` (schema `public`)
- Cliente: `supabaseAdmin` (inicializado con `SUPABASE_SERVICE_ROLE_KEY`)
