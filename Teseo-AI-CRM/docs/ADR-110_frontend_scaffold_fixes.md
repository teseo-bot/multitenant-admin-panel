# ADR-110: Estabilización de Scaffold y Dependencias en Next.js 14 (Tenant OS)
**Fecha:** 20 de Abril de 2026
**Estado:** Aprobado

## Contexto
Durante el scaffolding del `crm-agentico-panel` usando Next.js 14 App Router, la inicialización del middleware de Supabase SSR y las dependencias de fuentes externas por defecto (`next/font` - Geist) causaron bloqueos críticos en el renderizado local (Error 500 y White Screen of Death).

## Decisión
1. **Mockeo de Entorno Local (Zero-Trust):** Se estableció la inyección de variables *dummy* (`NEXT_PUBLIC_SUPABASE_URL` y `ANON_KEY`) en `.env.local` estrictamente para evadir el crash del cliente `@supabase/ssr` en el Middleware Edge durante el desarrollo UI, previniendo la necesidad de inyectar llaves de producción prematuramente.
2. **Desacoplamiento Tipográfico:** Se removió la dependencia dura `Geist` (`next/font/local`) del `app/layout.tsx`. El control tipográfico se delegó a las fuentes estándar del sistema mediante Tailwind (`font-sans`), erradicando la vulnerabilidad de compilación por assets faltantes.

## Consecuencias
- El entorno de desarrollo rutea correctamente sin dependencias fantasma.
- El Middleware Edge ejecuta exitosamente la protección Zero-Trust emitiendo redirecciones `307` hacia `/login`.
- El SDET (Tester) puede validar el DOM del *Tenant OS* de forma autónoma, sin depender de configuraciones manuales.