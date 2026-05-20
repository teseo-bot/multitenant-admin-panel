# ADR-133: Resolución de Bloqueos E2E - Despliegue Multi-Tenant y Seguridad

**Estado:** Implementado en Producción (Cloud Run)
**Fecha:** 22 Abril 2026

## 1. Contexto y Bloqueos Identificados
Durante el proceso de User Acceptance Testing (UAT) del Command Center en entorno real (Cloud Run), se presentaron los siguientes fallos críticos en cascada:
1. **Fuga y Hardcoding de Variables Dummy:** El proceso de construcción de Next.js estaba quemando las variables de entorno dummy (`build-dummy.local`) en el código estático, generando `Failed to fetch` hacia Supabase.
2. **Layout Overlap (Command Center):** Un conflicto de sintaxis entre Tailwind CSS v4 (esperado por Shadcn) y v3 (presente en el proyecto) generó el colapso del padding en el AppSidebar.
3. **Bypass del Middleware (Zero-Trust Fallo):** El archivo `middleware.ts` contenía una condición `false &&` que cortocircuitaba la validación JWT (PKCE), dejando el ruteo inoperante (404 a rutas inexistentes y loops vacíos en lugar de un rechazo explícito).
4. **Validación Zod Rota en API de Mensajes:** El HTTP POST handler hacia `inbox_messages` intentaba importar un validador inexistente, disparando siempre HTTP 500 y desencadenando un "Rollback Visual Optimista" (El UI eliminaba la burbuja del chat).

## 2. Decisiones Técnicas y Soluciones
- **Despliegue Dinámico en Cloud Build:** Se implementó un archivo `cloudbuild.yaml` estricto que inyecta los `build-args` con las llaves de acceso anónimas (Anon Key) reales durante la fase de transpilación del frontend (Docker Build).
- **Refactorización de Middleware SSR:** Se reescribió `updateSession` aplicando la restricción `AUTH_ROUTES` y `PROTECTED_PREFIXES` diseñada originalmente en el RFC-024. El flujo PKCE ahora opera bloqueando proactivamente el acceso anónimo y redirigiendo a `/auth/login`.
- **Refactorización y Tipado Seguro (Inbox):** Se corrigió la API REST de mensajes aislando los validadores en `lib/validations/message.ts`, resolviendo el rechazo de envíos desde el Composer.

## 3. Consecuencias
- La arquitectura de aislamiento "Monolito Web + Spoke Aislado" descrita en el `PRD-000` ya opera correctamente. Un SuperAdmin aterriza en `/tenants` y un Inquilino en `/command-center` mediante las mismas llaves y entorno.
- Las pruebas de Kanban D&D y Persistencia HTTP pasaron UAT de manera exitosa.
- **Deuda Técnica para Próximo Sprint:** Queda pendiente emular el diseño UI del proyecto interno `fleetco-plus` para consolidar visualmente la experiencia de usuario y resolver el Layout Overlap del Sidebar en el Panel Inbox.
