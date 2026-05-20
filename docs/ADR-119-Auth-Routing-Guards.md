# ADR-119 — Auth Routing Guards y Middleware Edge

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Sprint 1.4 - Ruteo y Navegación E2E
**Estado:** Aplicado y Verificado

## Problema
La ruta `/command-center` y los assets asociados no poseían protección real a nivel enrutador, lo que exponía la interfaz principal a usuarios no autenticados. Además, el formulario de Login era un stub de QA que heredaba el Layout maestro, provocando que el Sidebar se inyectara incorrectamente en la pantalla de autenticación.

## Decisión Técnica
1. **Middleware-First (Edge):** Implementación de una barrera Edge en `utils/supabase/middleware.ts` interceptando los `PROTECTED_PREFIXES` (`/command-center`, `/asset-studio`, `/campaign-review`).
2. **Redirección Segura:** Se inyectó la lógica de redirección `307` hacia `/auth/login?redirectTo={pathname}` para mantener la URL origen al hacer login.
3. **Route Groups:** Se reestructuró la topología de la carpeta `app/` utilizando `(dashboard)` para las rutas que requieren el `AppSidebar` y `(auth)` para aislar la pantalla de Login. Se purgó el `app/layout.tsx` a un shell HTML básico.
4. **Login Real:** Construcción de un Client Component (`"use client"`) implementando `react-hook-form`, `zod` y `@supabase/ssr` en la capa de UI.

## Consecuencias y Verificación
- **Mitigación de UI:** Se corrigió un "White Screen of Death" provocado por dependencias faltantes (`@hookform/resolvers`).
- **Verificación Tester (Zero-Trust):** PASS. El DOM renderiza correctamente en cliente sin advertencias ni fugas de Layout. El Middleware previene el acceso estricto y maneja los assets estáticos y las `AUTH_ROUTES` sin bucles infinitos.
