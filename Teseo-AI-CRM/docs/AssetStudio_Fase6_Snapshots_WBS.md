# Asset Studio — Fase 6: Headless Rendering Engine & Snapshots (WBS)

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-22 |
| **Estado** | Draft — Plan Maestro para Ejecutor |
| **Prerrequisitos** | Asset Studio UI, Rutas de Autenticación |
| **Stack** | Next.js 14, Playwright-core, Supabase Storage |

---

## 1. Sprint 6.1 — Infraestructura Storage (Dependencia Dura)

### Objetivo: Base de datos preparada para guardar imágenes
| # | Tarea | Est. | Archivo de Salida |
|---|---|---|---|
| 6.1.1 | Escribir migración SQL para el bucket `asset_snapshots` en Supabase. | 30m | `supabase/migrations/20260422000000_asset_snapshots_bucket.sql` |
| 6.1.2 | Configurar RLS: Inserciones solo autenticadas, Lecturas públicas (para evitar proxies de imágenes en UI). | 15m | (Incluido en 6.1.1) |

## 2. Sprint 6.2 — Dependencias y Entorno

### Objetivo: Playwright listo para correr en Edge/Serverless
| # | Tarea | Est. | Archivo de Salida |
|---|---|---|---|
| 6.2.1 | Mover `playwright-core` de `devDependencies` a `dependencies`. | 10m | `crm-agentico-panel/package.json` |
| 6.2.2 | Instalar tipados y asegurar que Vercel/Cloud Run ignore la descarga masiva si usamos un endpoint remoto, o usar Chromium local si es dedicado. | 20m | `crm-agentico-panel/package.json` |

## 3. Sprint 6.3 — Motor de Renderizado Headless (API)

### Objetivo: Un endpoint capaz de renderizar código y devolver una URL
| # | Tarea | Est. | Archivo de Salida |
|---|---|---|---|
| 6.3.1 | Crear la ruta `/api/asset-studio/snapshots/generate/route.ts` que reciba el `templateId` y opcional `versionId`. | 2h | `app/api/asset-studio/snapshots/generate/route.ts` |
| 6.3.2 | Instanciar `playwright-core`. Navegar a una ruta especial de render puro sin layout (e.g. `/render/prompts/[id]`). | 2h | `app/api/asset-studio/snapshots/generate/route.ts` |
| 6.3.3 | Implementar bypass de Auth: Pasar la cookie de sesión del Request de Next.js hacia el context del navegador Headless. | 1h | `app/api/asset-studio/snapshots/generate/route.ts` |
| 6.3.4 | Capturar el `.png` del locator `#render-container` y subir el Buffer directamente a Supabase `asset_snapshots`. Devolver la `publicUrl`. | 2h | `app/api/asset-studio/snapshots/generate/route.ts` |

## 4. Sprint 6.4 — Integración TanStack UI

### Objetivo: Cierre del ciclo en el Frontend
| # | Tarea | Est. | Archivo de Salida |
|---|---|---|---|
| 6.4.1 | Crear `useGenerateSnapshot` mutation. | 30m | `hooks/mutations/use-generate-snapshot.ts` |
| 6.4.2 | Agregar botón de "Generar Preview Real" en el editor, manejando los estados de carga y errores de red. | 1h | `components/asset-studio/editor-toolbar.tsx` |
