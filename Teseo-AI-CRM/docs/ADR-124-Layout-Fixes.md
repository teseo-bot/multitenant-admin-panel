# ADR-124 — Resolución de Conflictos 404 y Colisiones de Layout

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Cierre de Sprint 1 - Estabilización de Tenant OS
**Estado:** Iteración Inicial Completada (Fix pendiente)

## Problema
Tras la restructuración topológica en Route Groups (`(dashboard)` y `(auth)`), los enlaces del Sidebar arrojaron 404 al carecer de los prefijos de las nuevas subrutas. Además, se presentó una colisión severa en el Eje Z donde el `CommandCenterHeader` se superponía visualmente sobre la navegación del Sidebar en desktop.

## Decisión Técnica
1. **Mitigación de Enrutador:** Se remapearon estáticamente todos los `href` y métodos `router.push()` dentro de `app-sidebar.tsx` y layouts derivados (`/command-center`, `/asset-studio`, `/campaign-review`), eliminando los Errores 404 en la navegación troncal.
2. **Mitigación de Layout:** Se inyectaron constraints de flexbox (`min-w-0 overflow-hidden flex flex-col`) en el `<main>` adyacente al `AppSidebar` en `layout.tsx`. El objetivo es evitar que el KanbanBoard expanda el contenedor padre sobre el espacio reservado (`sidebar-gap`), aunque el resultado actual no satisfizo los estándares visuales en todas las resoluciones y requerirá una refactorización de CSS en la próxima sesión.

## Próximos Pasos
Se congeló la intervención y se comprometió el código a Git para levantar la próxima sesión con el contexto limpio, permitiendo un arreglo quirúrgico sobre la UI global.