# RFC-028 — Lead Details Sheet (Sprint 1.9)

| Campo         | Valor                                    |
|---------------|------------------------------------------|
| **Autor**     | Builder (Planificador)                   |
| **Fecha**     | 2026-04-21                               |
| **Sprint**    | 1.9                                      |
| **Status**    | Draft → Pendiente aprobación CEO         |
| **Depende de**| ADR-111 (TanStack Query), ADR-100 (Mission Control) |

---

## 1. Problema

Al seleccionar un Lead en el Kanban del `/command-center`, el Inbox Dual se activa mostrando la conversación. Sin embargo, **no existe ninguna interfaz para inspeccionar o editar la metadata del Lead** (nombre, empresa, email, teléfono, status, source, ICP score, assigned_node, metadata JSON).

El operador humano tiene que recurrir a la base de datos o a llamadas API manuales para modificar estos campos. Esto rompe el flujo operativo y aumenta el tiempo de gestión por lead.

## 2. Decisión de Diseño

### Componente: `Sheet` (shadcn/ui) desde la derecha

**¿Por qué Sheet y no Dialog?**

| Criterio                | Sheet (right)        | Dialog (modal)       |
|-------------------------|----------------------|----------------------|
| Contexto del Inbox      | ✅ Visible detrás     | ❌ Oculto por overlay |
| Espacio para formulario | ✅ Alto vertical libre | ⚠️ Limitado          |
| Patrón CRM estándar     | ✅ HubSpot, Pipedrive | ❌ Raro en CRMs      |
| Acceso rápido           | ✅ Un click en header  | ✅ Igual              |

**Decisión:** Usar `<Sheet side="right">` con ancho fijo de `sm:max-w-[420px]`.

### Punto de Invocación

Se agrega un botón/link clickeable en el `<InboxHeader>` existente. Al hacer click en el **nombre del Lead** (actualmente un `<h2>` estático) o en un nuevo botón `Info` (ícono `UserCog` de Lucide), se abre el Sheet.

### Wireframe ASCII

```
┌──────────────────────────────────────────────────────────────────┐
│  Command Center Header                                           │
├────────────────────────────┬─────────────────────────────────────┤
│                            │  Inbox Header                       │
│                            │  [Lead Name ←clickable] [ℹ️] [✕]   │
│     KANBAN BOARD           │─────────────────────────────────────│
│     (60%)                  │                                     │
│                            │  Message List                       │
│                            │                                     │
│                            │─────────────────────────────────────│
│                            │  Composer                           │
├────────────────────────────┴───────────────────┬─────────────────┤
│                                                │  SHEET (right)  │
│                                                │  ┌─────────────┐│
│                                                │  │ Lead Name   ││
│                                                │  │ Company     ││
│                                                │  │ Email       ││
│                                                │  │ Phone       ││
│                                                │  │ Status  [▼] ││
│                                                │  │ Source  [▼] ││
│                                                │  │ ICP    [━━] ││
│                                                │  │ Node   [▼] ││
│                                                │  │             ││
│                                                │  │ [Guardar]   ││
│                                                │  └─────────────┘│
└────────────────────────────────────────────────┴─────────────────┘
```

## 3. Arquitectura Técnica

### 3.1 Archivos Nuevos

| Archivo | Propósito |
|---------|-----------|
| `components/command-center/lead-details-sheet.tsx` | Componente principal: Sheet + formulario |
| `hooks/mutations/use-update-lead.ts` | Mutación PATCH con optimistic update |
| `hooks/queries/use-lead-detail.ts` | Query individual `GET /api/leads/[id]` |

### 3.2 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `components/command-center/inbox-header.tsx` | Agregar botón trigger del Sheet |
| `components/command-center/inbox-panel.tsx` | Montar `<LeadDetailsSheet>` |
| `stores/command-center-store.ts` | Agregar `isLeadSheetOpen` / `setIsLeadSheetOpen` |
| `app/api/leads/[id]/route.ts` | Agregar handler `GET` (retornar lead individual) |
| `lib/query-keys.ts` | Ya tiene `leads.detail(id)` — sin cambios |

### 3.3 Flujo de Datos

```
User clicks Lead Name in InboxHeader
  → setIsLeadSheetOpen(true) en Zustand
  → <LeadDetailsSheet> se monta con open={true}
  → useLeadDetail(selectedLeadId) dispara GET /api/leads/[id]
  → TanStack Query cachea bajo queryKeys.leads.detail(id)
  → react-hook-form se inicializa con defaultValues del query
  → Usuario edita campos
  → onSubmit → useUpdateLeadMutation.mutate(payload)
    → onMutate: optimistic update en leads.all + leads.detail(id)
    → fetch PATCH /api/leads/[id]
    → onSettled: invalidate leads.all + leads.detail(id)
  → toast de confirmación (sonner)
```

### 3.4 Schema del Formulario (Reutilización)

Se reutiliza `updateLeadSchema` de `lib/validations/lead.ts` directamente con `@hookform/resolvers/zod`. Los campos del formulario:

| Campo           | Input Type              | Zod field       |
|-----------------|-------------------------|-----------------|
| Nombre          | `<Input>`               | `name`          |
| Empresa         | `<Input>`               | `company`       |
| Email           | `<Input type="email">`  | `email`         |
| Teléfono        | `<Input type="tel">`    | `phone`         |
| Status          | `<Select>`              | `status`        |
| Source          | `<Select>` (disabled)   | — (solo lectura)|
| ICP Score       | `<Slider>` + número     | `icp_score`     |
| Assigned Node   | `<Select>`              | `assigned_node` |

**Nota:** `source` se muestra como solo lectura (Badge) porque el source original del lead no debe ser editable post-creación. `metadata` JSON no se expone en V1 (se puede agregar en Sprint 2.x como editor JSON expandible).

### 3.5 API: GET handler faltante

El endpoint `app/api/leads/[id]/route.ts` actualmente solo tiene `PATCH` y `DELETE`. Se necesita agregar un `GET` que retorne el lead individual:

```typescript
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const uuidValidation = uuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json({ error: 'Invalid UUID' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return NextResponse.json({ data });
}
```

### 3.6 Optimistic Update Pattern

Se replica el patrón ya probado en `use-move-lead.ts`:

```typescript
onMutate: async ({ leadId, payload }) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });
  await queryClient.cancelQueries({ queryKey: queryKeys.leads.detail(leadId) });

  const snapshotAll = queryClient.getQueryData<Lead[]>(queryKeys.leads.all);
  const snapshotDetail = queryClient.getQueryData<Lead>(queryKeys.leads.detail(leadId));

  // Optimistic: actualizar ambas caches
  if (snapshotAll) {
    queryClient.setQueryData<Lead[]>(queryKeys.leads.all, (old) =>
      old?.map((l) => l.id === leadId ? { ...l, ...payload } : l) ?? []
    );
  }
  if (snapshotDetail) {
    queryClient.setQueryData<Lead>(queryKeys.leads.detail(leadId), (old) =>
      old ? { ...old, ...payload } : old
    );
  }

  return { snapshotAll, snapshotDetail };
},
onError: (_err, { leadId }, context) => {
  if (context?.snapshotAll) queryClient.setQueryData(queryKeys.leads.all, context.snapshotAll);
  if (context?.snapshotDetail) queryClient.setQueryData(queryKeys.leads.detail(leadId), context.snapshotDetail);
},
onSettled: (_data, _err, { leadId }) => {
  queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
},
```

### 3.7 Estado Zustand (Mínimo)

Agregar al `command-center-store.ts`:

```typescript
isLeadSheetOpen: boolean;
setIsLeadSheetOpen: (v: boolean) => void;
```

El Sheet se cierra al: (1) click en overlay, (2) click en X, (3) submit exitoso, (4) cambio de `selectedLeadId`.

---

## 4. UX Detalle

- **Loading state:** Skeleton de 8 líneas dentro del Sheet mientras carga `useLeadDetail`.
- **Error state:** Mensaje inline con botón retry.
- **Dirty form guard:** Si el form tiene cambios sin guardar y el usuario cierra el Sheet, se muestra un `AlertDialog` de confirmación.
- **Keyboard:** `Escape` cierra el Sheet (comportamiento nativo de shadcn Sheet).
- **Toast:** `sonner` para feedback de guardado ("Lead actualizado" / "Error al actualizar").
- **Mobile:** En mobile, el Sheet ocupa `w-full` (overlay completo), ya que el layout 60/40 colapsa a tabs.

---

## 5. Dependencias (ya instaladas)

- `@radix-ui/react-dialog` (base de Sheet) ✅
- `react-hook-form` + `@hookform/resolvers` ✅
- `zod` ✅
- `@tanstack/react-query` ✅
- `sonner` ✅
- `lucide-react` ✅

No se requieren instalaciones nuevas.

---

## 6. WBS — Work Breakdown Structure

Tareas atómicas para el Night Coder (Ejecutor). Orden estrictamente secuencial.

### WBS-028.1 — API GET handler para lead individual
**Archivo:** `app/api/leads/[id]/route.ts`
**Acción:** Agregar función `GET` exportada (ver §3.5).
**Criterio de aceptación:** `curl GET /api/leads/{uuid}` retorna `{ data: Lead }` con status 200.
**Estimación:** 10 min.

### WBS-028.2 — Hook `useLeadDetail`
**Archivo nuevo:** `hooks/queries/use-lead-detail.ts`
**Acción:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Lead } from '@/types/lead';

export function useLeadDetail(leadId: string | null) {
  return useQuery<Lead>({
    queryKey: queryKeys.leads.detail(leadId!),
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch lead');
      const json = await res.json();
      return json.data;
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });
}
```
**Criterio de aceptación:** El hook compila sin errores TS. Query se desactiva si leadId es null.
**Estimación:** 10 min.

### WBS-028.3 — Hook `useUpdateLeadMutation`
**Archivo nuevo:** `hooks/mutations/use-update-lead.ts`
**Acción:** Crear mutación con optimistic update dual (leads.all + leads.detail). Patrón en §3.6. Incluir toast de sonner en `onSuccess` y `onError`.
**Criterio de aceptación:** Mutación compila. Optimistic rollback funciona en red simulada con error.
**Estimación:** 20 min.

### WBS-028.4 — Estado Zustand `isLeadSheetOpen`
**Archivo:** `stores/command-center-store.ts`
**Acción:** Agregar `isLeadSheetOpen: boolean` (default `false`) y `setIsLeadSheetOpen: (v: boolean) => void` al store.
**Criterio de aceptación:** No se rompe ningún consumer existente del store.
**Estimación:** 5 min.

### WBS-028.5 — Componente `LeadDetailsSheet`
**Archivo nuevo:** `components/command-center/lead-details-sheet.tsx`
**Acción:**
- Importar `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` de `@/components/ui/sheet`.
- Usar `useLeadDetail(selectedLeadId)` para cargar datos.
- Inicializar `react-hook-form` con `zodResolver(updateLeadSchema)`.
- `useEffect` para resetear el form con `reset(leadData)` cuando los datos cargan.
- Campos del formulario según tabla §3.4.
- Sección de solo lectura: `source` (Badge), `created_at`, `updated_at` (formateados).
- Submit → `useUpdateLeadMutation`.
- Skeleton loader cuando `isLoading`.
- Dirty guard con `AlertDialog` al intentar cerrar con `formState.isDirty`.
**Criterio de aceptación:** Sheet se abre, muestra datos del lead, permite editar y guardar. Cambios reflejados inmediatamente en Kanban (optimistic).
**Estimación:** 45 min.

### WBS-028.6 — Integrar trigger en `InboxHeader`
**Archivo:** `components/command-center/inbox-header.tsx`
**Acción:**
- Hacer el `<h2>` del nombre del lead clickeable (`cursor-pointer`, `hover:underline`).
- Al click: `setIsLeadSheetOpen(true)`.
- Agregar ícono `UserCog` como botón alternativo junto al botón X existente.
**Criterio de aceptación:** Click en nombre o ícono abre el Sheet.
**Estimación:** 10 min.

### WBS-028.7 — Montar Sheet en `InboxPanel`
**Archivo:** `components/command-center/inbox-panel.tsx`
**Acción:**
- Importar `LeadDetailsSheet`.
- Renderizar `<LeadDetailsSheet />` dentro del return del InboxPanel (después del Composer).
- El Sheet lee `isLeadSheetOpen` y `selectedLeadId` del store.
- Agregar `useEffect` para cerrar el Sheet cuando `selectedLeadId` cambia.
**Criterio de aceptación:** Sheet se monta correctamente. No interfiere con Inbox existente.
**Estimación:** 10 min.

### WBS-028.8 — Pruebas manuales y smoke test
**Acción:**
1. Abrir `/command-center`, seleccionar lead en Kanban.
2. Click en nombre → Sheet abre con datos correctos.
3. Editar nombre y status → Guardar → Kanban refleja cambio (optimistic).
4. Cerrar Sheet con cambios pendientes → AlertDialog aparece.
5. Mobile: Sheet ocupa pantalla completa.
6. Error de red: toast de error, rollback visible.
**Estimación:** 15 min.

---

## 7. Resumen de Estimación

| WBS    | Tarea                         | Min  |
|--------|-------------------------------|------|
| 028.1  | API GET handler               | 10   |
| 028.2  | useLeadDetail hook            | 10   |
| 028.3  | useUpdateLeadMutation hook    | 20   |
| 028.4  | Zustand state                 | 5    |
| 028.5  | LeadDetailsSheet component    | 45   |
| 028.6  | InboxHeader trigger           | 10   |
| 028.7  | InboxPanel mount              | 10   |
| 028.8  | Smoke test                    | 15   |
| **Total** |                            | **~2h** |

---

## 8. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Stale data si otro operador edita el mismo lead | Medio | SSE sync (`useLeadSSE`) ya invalida `leads.all`. Extender para invalidar `leads.detail(id)` también. |
| Race condition entre optimistic update del Sheet y drag-drop del Kanban | Bajo | Ambas mutaciones operan sobre `leads.all` con snapshot/rollback. TanStack Query serializa invalidaciones. |
| Form reset al cambiar de lead con sheet abierto | Medio | `useEffect` en `selectedLeadId` cierra el Sheet + resetea form. |

---

## 9. Fuera de Alcance (Sprint 2.x)

- Editor de campo `metadata` (JSON editor expandible).
- Historial de cambios / Activity Log dentro del Sheet.
- Campos custom definidos por tenant.
- Bulk edit de múltiples leads.
