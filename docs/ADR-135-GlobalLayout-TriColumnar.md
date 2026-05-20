# ADR-135: Consolidación del Patrón Tri-Columnar (GlobalLayout) y Zero-Trust Edge Guard

**Fecha:** 22 Abril 2026
**Estado:** Aprobado / Implementado
**Autor:** Teseo (Gerente AIDevops) & Escuadrón Táctico

## 1. Contexto y Desafío
El Tenant OS (`crm-agentico-panel`) sufría de solapamientos visuales y de deuda estructural al heredar componentes base de Shadcn sin un orquestador de Layout global unificado. La navegación y el manejo de Layout se mezclaban con la lógica del Auth Guard (`middleware.ts`), lo cual representaba un riesgo para la escalabilidad en la integración con Supabase.

## 2. Decisión Arquitectónica
- Se decidió extraer el patrón de diseño "GlobalLayout / Tri-Columnar" comprobado en `fleetco-plus` y adaptarlo al App Router de Next.js.
- **Route Groups (`(dashboard)`, `(auth)`)**: Se implementó una separación estricta para garantizar que las capas protegidas puedan acceder al contexto del Layout sin exponer los endpoints de autenticación.
- **SSR Auth Injection**: Se transicionó a una inyección del objeto `user` vía SSR a través de `createClient()` de Supabase, suprimiendo la dependencia en Providers de cliente para Auth y acelerando la primera pintura segura.
- **Server Action Logout**: Se desacopló el flujo de logout en `/app/(auth)/actions.ts` ("use server") y se invocó puramente a través de un tag `<form>`, previniendo el uso de Context y blindando el lado del cliente.
- **Zero-Trust Middleware**: El `middleware.ts` a nivel de Edge fue preservado 100% intacto; se confió el acceso a las rutas protegidas a Server Components (Test Gate).

## 3. Consecuencias
**Positivas:**
- Consola limpia (Cero "White Screen of Death" y Cero React Warnings por props leak en el DOM, corregido mediante hotfix del prop `autoSaveId`).
- Código aislado: El código muerto del antiguo cascarón de Layout (`components/layout/app-sidebar.tsx`) ha sido borrado.
- Hidratación optimizada en mobile/desktop.

**Deuda Técnica (Post-Mortem):**
- El atributo `role` del objeto User en el `DashboardLayout` se encuentra forzado a `"user"`/`"admin"` por compatibilidad temporal de tipado. Requerirá conectarse formalmente a `app_metadata` o `user_metadata` en un futuro cercano (ticket diferido).
- Algunos scripts MJS y PNGs temporales se agregaron al `.gitignore` para supresión en este bloque.

## 4. Punto de Restauración
El código fue auditado por el equipo de QA (PASS) y empaquetado en el commit atómico `094b73d` dentro de la rama `main`.
