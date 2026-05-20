# ADR-125: Asset Studio Canvas Engine & State Segregation (Fase 5)

## Fecha
21 de Abril de 2026

## Contexto
El Asset Studio requería un entorno de edición visual (Canvas) para la manipulación de templates y assets bajo el estándar de HyperFrames. Era crítico evitar colisiones de re-renderizado en React provocadas por animaciones complejas, y al mismo tiempo garantizar que el estado transitorio de edición (borradores) no contaminara el Server State ni la base de datos hasta que el usuario decidiera guardar explícitamente.

## Decisión Técnica
1. **Motor de Animación:** Se seleccionó **GSAP** como motor principal, gestionando el ciclo de vida del tiempo fuera del React rendering cycle mediante el registro `window.__timelines`. Se impuso la regla estricta de "Layout Before Animation" (uso de Flexbox/Grid, cero `position: absolute` global).
2. **Segregación de Estado Estricta:** 
   - **Zustand (`use-canvas-store.ts`):** Maneja exclusivamente el estado transitorio (Scrubber, Play/Pause, Nodos seleccionados y `draftAttributes`).
   - **TanStack Query:** Encargado del Server State y el fetching de datos persistentes. La interfaz de propiedades muta Zustand localmente y luego empuja un Payload atómico al backend.
3. **Backend for Frontend (BFF):** Creación del Route Handler `/api/asset-studio/canvas/save` protegido mediante Edge/SSR Supabase Auth, asegurando el aislamiento por Tenant (RLS a nivel lógico) y validación de tipos con Zod.

## Consecuencias
- **Mantenibilidad:** El código visual está totalmente desacoplado del estado asíncrono de base de datos.
- **Rendimiento:** Las animaciones operan directamente sobre el DOM sin disparar el reconciliador de React, manteniendo 60fps constantes.
- **Deuda Técnica Saldada:** Se extendió `types/global.d.ts` para tipar el scope global sin recurrir a type casting inseguro (`any`).
