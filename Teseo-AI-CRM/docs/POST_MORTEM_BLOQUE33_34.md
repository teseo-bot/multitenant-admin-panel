# POST MORTEM - Bloques 33 y 34 (Protocolo de Invernación)

**Fecha:** 25 Abril 2026  
**Autor:** Teseo (Gerente AIDevops)  
**Track:** Producción y Refactorización Core

## 1. Resumen de Ejecución
Se completaron de forma consecutiva los Bloques 33 y 34, resolviendo el desacoplamiento de la interfaz en tiempo real (Zero-F5) y la migración del motor de investigación hacia una arquitectura de alto rendimiento.

## 2. Decisiones Arquitectónicas (ADR / PRD)
- **Bloque 33 (SSE Zero-F5):**
  - Se descartó el uso de WebSockets bidireccionales por complejidad innecesaria. Se optó por **Server-Sent Events (SSE)** unidireccional.
  - El Orquestador (Hono) implementó un `EventBus` in-memory.
  - El Command Center implementó un estado local reactivo (`useProspectSSE`) con reconexión exponencial.
- **Bloque 34 (Migración Obscura):**
  - Se eliminó la dependencia de Puppeteer.
  - Se implementó un cliente nativo Chrome DevTools Protocol (CDP) en TypeScript.
  - **Topología Cloud:** Despliegue *Multi-Container Sidecar* en GCP Cloud Run (Gen2). Orquestador (Node) en puerto 3000 + Obscura (Rust) en puerto 9222 compartiendo red `localhost`.
  - Feature Flag inyectado: `FEATURE_OBSCURA_ENABLED`.

## 3. Resolución de Incidentes (Drift/Fricciones)
1. **Cloud Build (Orquestador):** El Dockerfile tenía un fallback (`|| npx tsc`) que, ante picos de memoria en la nube, compilaba con el `tsconfig.json` base en lugar de `tsconfig.build.json`. Esto corrompía la estructura de directorios en `dist/`. *Solución:* Se forzó el modo estricto removiendo el fallback.
2. **Cloud Build (Command Center):** Next.js ejecutaba chequeos de ESLint en CI (Cloud Build) que no frenaban el `dev` local. Hubo 17 errores de tipado `any` y variables no usadas que abortaban la creación del folder `.standalone`. *Solución:* El Ejecutor resolvió el linting y aseguró el tipado.

## 4. Estado de Congelación
El código está persistido en `main`. Los despliegues hacia Cloud Run están en proceso de compilación (vía Triggers de Cloud Build). El pipeline está en verde localmente y las suites de pruebas (unit/E2E) pasan al 100% (21/21 tests verdes para Obscura).