# RFC-057: Saneamiento TypeScript Post-Polyrepo (ADR-069)

**Fecha:** 2026-04-24
**Estado:** Propuesto
**Autor:** Teseo (AI DevOps)
**Contexto:** ADR-069 – Cirugía Polyrepo e Ignición de Staging

---

## 1. Problema

Tras la consolidación Polyrepo (ADR-069), el frontend aplanado compila con `next build` pero falla en la fase de **type-checking** con un error bloqueante. Un análisis exhaustivo con `tsc --noEmit` revela **3 categorías de deuda técnica** que deben resolverse para un build limpio y CI/CD verde.

### 1.1 Inventario de Errores (24 Abril 2026)

| # | Archivo | Error | Categoría |
|---|---------|-------|-----------|
| 1 | `components/dashboard/analytics-view.tsx:32` | `TS2304: Cannot find name 'AnalyticsPayload'` | Import faltante |
| 2 | `components/dashboard/analytics-view.tsx:37` | `TS7006: Parameter 'd' implicitly has an 'any'` | Strict typing |
| 3 | `hooks/queries/use-analytics.ts:2` | `TS2307: Cannot find module '@/lib/supabase/client'` | Ruta rota |
| 4 | `hooks/use-lead-sse.ts:3` | `TS2307: Cannot find module '@/lib/stores/agent-stream-store'` | Ruta rota |
| 5 | `hooks/use-lead-sse.ts:7` | `TS7006: Parameter 'state' implicitly has an 'any'` | Strict typing |
| 6 | `vitest.config.ts` | `TS2307: Cannot find module 'vitest/config'` | Dep faltante |
| 7 | `vitest.config.ts` | `TS2307: Cannot find module '@vitejs/plugin-react'` | Dep faltante |
| 8 | `__tests__/…tenant-switcher.test.tsx` | `TS2307: Cannot find module 'vitest'` | Dep faltante |
| 9 | `__tests__/…tenant-switcher.test.tsx` | `TS2307: Cannot find module '@testing-library/react'` | Dep faltante |
| 10 | `__tests__/…api-client.test.ts` | `TS2307: Cannot find module 'vitest'` | Dep faltante |

**Error bloqueante para `next build`:** Solo el #1.
**Errores latentes (tsc --noEmit):** #2–#10, invisibles para Next.js hoy pero bloquean CI strict-mode y editores.

---

## 2. Análisis de Causa Raíz

### 2.1 Import faltante (`AnalyticsPayload`)
`analytics-view.tsx` importa `useAnalytics` desde `@/hooks/queries/use-analytics` pero **no importa** la interfaz `AnalyticsPayload` que está exportada en el mismo módulo. Es un olvido de autoría; la interfaz existe y es correcta.

### 2.2 Rutas de importación rotas
- **`@/lib/supabase/client`**: No existe. El cliente Supabase real vive en `utils/supabase/client.ts` y exporta `createClient()` (no `supabaseBrowser`). La firma difiere.
- **`@/lib/stores/agent-stream-store`**: No existe bajo `lib/`. El store real vive en `stores/agent-stream-store.ts`. La ruta correcta es `@/stores/agent-stream-store`.

### 2.3 Dependencias de testing no declaradas
`vitest`, `@vitejs/plugin-react`, y `@testing-library/react` no están en `package.json` (ni en dependencies ni en devDependencies), pero `vitest.config.ts` y `__tests__/` los referencian. Quedaron huérfanos tras el aplanamiento.

---

## 3. WBS – Plan de Saneamiento

### Fase 1: Fix Bloqueante de Build (P0 — Inmediato)

**Tarea 1.1 — Agregar import de `AnalyticsPayload`**
- Archivo: `components/dashboard/analytics-view.tsx`
- Cambio: Agregar `AnalyticsPayload` al import existente de `useAnalytics`
  ```typescript
  import { useAnalytics, AnalyticsPayload } from "@/hooks/queries/use-analytics";
  ```
- Validación: `npm run build` pasa limpio

### Fase 2: Corregir Rutas de Importación Rotas (P1 — Mismo día)

**Tarea 2.1 — Resolver `@/lib/supabase/client`**
- Archivo: `hooks/queries/use-analytics.ts`
- Opción A (preferida): Crear barrel `lib/supabase/client.ts` que re-exporte adaptando la firma:
  ```typescript
  import { createClient } from '@/utils/supabase/client';
  export const supabaseBrowser = createClient();
  ```
- Opción B: Reescribir el import en `use-analytics.ts` para usar `@/utils/supabase/client` directamente y adaptar el uso de `supabaseBrowser` a `createClient()`.
- Criterio: Si más de 3 archivos usan `@/lib/supabase/client`, usar Opción A. Si es solo este, usar Opción B.

**Tarea 2.2 — Resolver `@/lib/stores/agent-stream-store`**
- Archivo: `hooks/use-lead-sse.ts`
- Cambio: Corregir import de `@/lib/stores/agent-stream-store` → `@/stores/agent-stream-store`

### Fase 3: Resolver Strict Typing (P1 — Mismo día)

**Tarea 3.1 — Tipar parámetro `d` en `analytics-view.tsx:37`**
- El `.find(d => ...)` opera sobre `statusDistribution` que es `LeadsByStatus[]`.
- Cambio: `(d: LeadsByStatus)` o asegurar que el tipo infiera correctamente tras la Fase 1.

**Tarea 3.2 — Tipar parámetro `state` en `use-lead-sse.ts:7`**
- Verificar el tipo del store de Zustand y agregar anotación explícita o importar el tipo del state del store.

### Fase 4: Instalar Dependencias de Testing (P2 — Sprint siguiente)

**Tarea 4.1 — Declarar devDependencies de testing**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
```

**Tarea 4.2 — Validar configuración de vitest**
- Verificar que `vitest.config.ts` es compatible con la estructura aplanada.
- Ejecutar `npx vitest --run` y confirmar que los tests existentes pasan.

**Tarea 4.3 — (Alternativa) Excluir tests del check de tipos**
- Si los tests no son prioritarios, agregar `__tests__` y `vitest.config.ts` al `exclude` de `tsconfig.json`:
  ```json
  "exclude": ["node_modules", "__tests__", "vitest.config.ts"]
  ```

### Fase 5: Validación Final (Gate de Calidad)

**Tarea 5.1 — Build limpio**
```bash
npm run build   # Exit code 0, sin errores
```

**Tarea 5.2 — Type-check estricto**
```bash
npx tsc --noEmit  # 0 errores
```

**Tarea 5.3 — Commit y push**
- Commit con mensaje: `fix(types): resolve post-polyrepo TS errors (RFC-057)`
- Verificar que CI/CD pipeline pasa verde.

---

## 4. Estimación de Esfuerzo

| Fase | Esfuerzo | Riesgo |
|------|----------|--------|
| Fase 1 (build fix) | 5 min | Nulo — cambio de 1 línea |
| Fase 2 (rutas) | 15 min | Bajo — requiere decidir barrel vs rewrite |
| Fase 3 (strict types) | 10 min | Bajo |
| Fase 4 (test deps) | 20 min | Medio — puede revelar tests rotos |
| Fase 5 (validación) | 10 min | Nulo |
| **Total** | **~1 hora** | |

---

## 5. Decisión Recomendada

Ejecutar las Fases 1–3 inmediatamente (30 min) para desbloquear el build y el CI. La Fase 4 (testing) puede diferirse al próximo sprint si no hay tests en el pipeline de CI actual.

---

**Firmado:** Teseo (AI DevOps)
**Pendiente aprobación:** Jorge García (CEO)
