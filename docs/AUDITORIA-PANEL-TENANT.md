# Auditoría Técnica — Panel de Tenant

**Fecha:** 2026-06-04
**Alcance:** Módulo de configuración de tenant (`app/(control-panel)/tenants/[tenantId]/`), sistema de layout y componentes UI relacionados.
**Motivo:** Tras múltiples cambios y ajustes sucesivos, la interfaz del panel de tenant se rompe (componentes desbordándose fuera del área de contenido). El historial de commits y la presencia de 17 scripts de parcheo sueltos (`fix_*.py` / `fix_*.sh`) en la raíz evidencian tratamiento sintomático acumulado.

---

## Resumen ejecutivo

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| 1 | Bug funcional de Tabs: selector Radix sobre componente base-ui | 🔴 Crítico | ✅ Resuelto (fix quirúrgico) |
| 2 | Overflow tratado con curitas en vez de la causa raíz | 🔴 Crítico | ✅ Resuelto (fix quirúrgico) |
| 3 | Dos sistemas de layout coexistiendo | 🟠 Alto | ⬜ Pendiente |
| 4 | 17 scripts `fix_*.py/.sh` versionados en la raíz | 🟠 Alto | ⬜ Pendiente |
| 5 | Server actions con degradación silenciosa de errores SQL | 🟡 Medio | ⬜ Pendiente |
| 6 | Mocks y datos hardcodeados en producción | 🟡 Medio | ⬜ Pendiente |
| 7 | Pérdida de tipado (`any` / `as any`) | 🟡 Medio | ⬜ Pendiente |
| 8 | Fetch en cliente innecesario (anti-patrón Server Component) | ⚪ Bajo | ⬜ Pendiente |

Los hallazgos **1 y 2 eran la causa visible de la rotura** y ya están resueltos quirúrgicamente. Del 3 al 8 es deuda técnica que conviene resolver por capas para estabilizar el módulo.

---

## 1. 🔴 Bug funcional de Tabs — desajuste de API (Radix vs base-ui)

**Síntoma:** Las pestañas no muestran indicador de pestaña activa y heredan estilos base contradictorios; el conjunto se ve "roto".

**Causa raíz:** `components/ui/tabs.tsx` envuelve **`@base-ui/react/tabs`**, no Radix. base-ui expone el estado activo mediante el atributo `data-active`. Sin embargo, `TenantDetailsClient.tsx` aplicaba clases con la convención de **Radix** (`data-[state=active]:border-primary`), que nunca coincide con el DOM real → el estilo activo jamás se aplicaba. Además, el `TabsTrigger` de base-ui trae `flex-1` por defecto, estirando los tabs de forma no deseada.

**Evidencia:**
- `components/ui/tabs.tsx` (usa internamente `data-active:bg-background`, confirmando la convención base-ui).
- `app/(control-panel)/tenants/[tenantId]/TenantDetailsClient.tsx` (usaba `data-[state=active]:`).

**Recomendación / corrección aplicada:**
- Usar `data-active:` (no `data-[state=active]:`) para estilar el estado activo.
- Añadir `flex-none` a los triggers para neutralizar el `flex-1` por defecto.
- **Estandarizar:** prohibir mezclar convenciones Radix y base-ui en el mismo componente. Considerar adoptar el `variant="line"` que ya ofrece `tabs.tsx`, que provee el subrayado activo correctamente cableado a `data-active` sin clases manuales.

**Acción de equipo:** Auditar el resto del código en busca de `data-[state=` aplicado sobre componentes base-ui (grep) y normalizar.

---

## 2. 🔴 Overflow: tratamiento sintomático en vez de causa raíz

**Síntoma:** Los componentes (especialmente tablas) desbordan el área de contenido hacia la derecha.

**Causa raíz:** Comportamiento `min-width: auto` de los hijos flex. En la cadena `SidebarInset (flex) → main → div flex-1 → Tabs → tabla`, un hijo flex no se encoge por debajo de su contenido salvo que tenga `min-width: 0`. Una tabla ancha empuja a todos sus ancestros más allá del viewport.

La "solución" previa fue sembrar `w-full`, `max-w-full`, `overflow-x-hidden`, `overflow-x-auto` y `min-w-0` de forma repetida en **cada nivel y cada tab**, lo que recorta contenido y genera scrollbars dobles sin resolver la restricción.

**Evidencia:** Commits `a7e550b9`, `18bea041`, `2e0d8f3e` y la densidad de utilidades de overflow repetidas en los 7 archivos de `tabs/`.

**Recomendación / corrección aplicada:**
- **Patrón canónico (una sola fuente de verdad):**
  1. `min-w-0` en cada eslabón de la cadena flex que deba poder encogerse (contenedor de contenido, `Tabs`, cada `TabsContent`).
  2. **Un único** wrapper con `overflow-x-auto` alrededor de cada tabla (ya existe en los tabs).
  3. Eliminar los `overflow-x-hidden` / `max-w-full` que recortan contenido a nivel de contenedor.
- **Acción de equipo:** Hacer una pasada de limpieza eliminando las utilidades de overflow redundantes en los 7 tabs, dejando solo el wrapper de scroll de la tabla. Documentar el patrón en una guía de estilos interna para que no se vuelva a sembrar.

---

## 3. 🟠 Dos sistemas de layout coexistiendo

**Problema:** Conviven dos arquitecturas de layout incompatibles:
- `app/(control-panel)/layout.tsx`: shadcn `SidebarProvider` + `SidebarInset` + `ControlPanelSidebar`.
- `components/layout/GlobalLayout.tsx` (usado por `app/(dashboard)/layout.tsx`): sidebar custom (`AppSidebar`) con `margin-left` manual y lógica de hidratación propia.

Dos sidebars, dos formas de medir/reservar ancho, dos modelos mentales. Esto multiplica la superficie de bugs de layout y dificulta razonar sobre el overflow.

**Recomendación:**
- Elegir **un** sistema (se recomienda el de shadcn `SidebarProvider/SidebarInset`, que maneja colapso, offset e hidratación de forma estándar) y migrar el otro.
- Eliminar el sistema redundante una vez migrado.
- **Acción de equipo:** Decisión arquitectónica + migración planificada (no urgente, pero bloquea la estabilidad a largo plazo).

---

## 4. 🟠 Scripts de parcheo versionados en la raíz

**Problema:** 17 archivos en la raíz del repositorio:
`fix_42p01.py`, `fix_500_final.sh`, `fix_500_tabs.sh`, `fix_actions.py`, `fix_all.py`, `fix_all.sh`, `fix_behavior.sh`, `fix_behavior2.sh`, `fix_behavior3.sh`, `fix_build.sh`, `fix_dockerfile.sh`, `fix_exports.sh`, `fix_prompts_tab.py`, `fix_prompts_tab2.py`, `fix_schemas.py`, `fix_tabs.py`, `fix_tabs_2.py`.

Ejecutan `sed`/regex destructivos sobre el código fuente. Riesgos: (a) si alguien los re-ejecuta, corrompe archivos; (b) ensucian el repo; (c) reflejan ediciones a mano sin revisión.

**Recomendación:**
- Eliminarlos del repositorio (`git rm` si están versionados; borrarlos si son untracked).
- Añadir un patrón a `.gitignore` para scripts temporales (p.ej. `fix_*.py`, `fix_*.sh`) o, mejor, prohibir scripts de parcheo ad-hoc en favor de migraciones/PRs revisados.
- **Acción de equipo:** Limpieza inmediata, bajo riesgo.

---

## 5. 🟡 Degradación silenciosa de errores SQL

**Problema:** Los server actions (`_actions.ts`, `_behaviorActions.ts`, `_brandingActions.ts`) capturan errores Postgres `42P01` (tabla inexistente) y `42703` (columna inexistente) devolviendo valores fallback. Esto **esconde un esquema de base de datos desincronizado** en lugar de corregirlo.

**Evidencia:** Lógica de `if (error?.code === '42P01' || error?.code === '42703')` introducida por `fix_500_final.sh` y commit `2e0d8f3e`.

**Recomendación:**
- Sincronizar el esquema con **migraciones versionadas** que garanticen tablas/columnas, en vez de tolerar su ausencia en runtime.
- Reservar el fallback solo para estados legítimamente opcionales; cualquier `42P01/42703` inesperado debe loguearse a nivel de error y alertar, no silenciarse.
- **Acción de equipo:** Auditar qué tablas/columnas faltan en cada entorno y crear las migraciones correspondientes.

---

## 6. 🟡 Mocks y datos hardcodeados en producción

**Problema:**
- `_apiKeysActions.ts` retorna URLs `localhost` hardcodeadas para `test-tenant-1` / `test-tenant-2`.
- `AccessRolesTab.tsx` renderiza una tabla vacía estática ("No hay…") sin fuente de datos real.

Funcionalidad incompleta mezclada con código de producción.

**Recomendación:**
- Mover URLs/tokens de prueba a variables de entorno o a un seed de desarrollo; no embeberlos en el action.
- Completar (o marcar explícitamente como WIP con feature flag) los tabs con datos mock para que no aparenten estar funcionales.
- **Acción de equipo:** Inventariar tabs/actions incompletos y decidir completar vs. ocultar tras flag.

---

## 7. 🟡 Pérdida de tipado (`any` / `as any`)

**Problema:** En `TenantDetailsClient.tsx`, los cuatro datasets iniciales usan `useState<any>` y se pasan props con `as any`, pese a que existen esquemas Zod (`schemas.ts`) y tipos definidos (`_behaviorTypes.ts`, `_brandingTypes.ts`, etc.).

**Recomendación:**
- Tipar el estado con los tipos ya definidos / inferidos desde los esquemas Zod (`z.infer<typeof schema>`).
- Eliminar los `as any` en las props de los tabs.
- **Acción de equipo:** Refactor de tipos contenido al archivo cliente; bajo riesgo, alto valor de mantenibilidad.

---

## 8. ⚪ Fetch en cliente innecesario (anti-patrón Server Component)

**Problema:** `page.tsx` es un Server Component `force-dynamic` que delega todo a `TenantDetailsClient`, el cual dispara 4 server-actions dentro de un `useEffect`. Esto genera waterfall de red, flash de skeleton y peor LCP.

**Recomendación:**
- Cargar los datos en el Server Component (`page.tsx`) con `Promise.all`, y pasar los resultados como props al cliente. El cliente solo maneja interactividad/guardado.
- Elimina el skeleton de carga inicial y mejora el rendimiento percibido.
- **Acción de equipo:** Refactor de data-fetching; requiere validar que los actions sean invocables desde el server (la mayoría ya lo son).

---

## Prioridad recomendada de resolución

1. **Inmediato / bajo riesgo:** #4 (limpieza de scripts), #7 (tipado).
2. **Corto plazo:** #5 (migraciones de esquema), #6 (mocks).
3. **Mediano plazo / decisión arquitectónica:** #3 (unificar layout), #8 (data-fetching en server).
4. **Ya resueltos (verificar en QA):** #1 y #2.

## Notas para el revisor / QA

- Verificar visualmente: la barra de pestañas debe mostrar el subrayado `primary` en la pestaña activa, y los tabs con tabla (*API Keys*, *Accesos & Roles*) deben hacer scroll horizontal **dentro** de su tarjeta, sin empujar contenido fuera del área.
- Gotcha clave a recordar: `components/ui/tabs.tsx` usa **base-ui** (`data-active`), no Radix (`data-[state=active]`).
