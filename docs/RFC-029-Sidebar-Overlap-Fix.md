# RFC-029: Solución al Solapamiento Visual del Sidebar (Overlap Fix)

## 1. Análisis de la Causa Raíz (Root Cause)
Durante el sprint pasado, se detectó un solapamiento visual entre el componente `AppSidebar` (shadcn) y el contenido principal (Main Canvas / Header) en el `CommandCenter`. 
Tras auditar el código fuente, la causa raíz se divide en dos problemas arquitectónicos:

1. **Incompatibilidad de sintaxis de Tailwind CSS (v4 vs v3):**
   El componente base de Shadcn (`components/ui/sidebar.tsx`) fue autogenerado asumiendo Tailwind CSS v4, e incluye clases como `w-(--sidebar-width)` y variables como `(--spacing(4))`. El proyecto actualiza y compila con **Tailwind CSS v3.4.1** (según el `package.json`).
   - *Efecto:* Al no existir soporte nativo en v3 para esta sintaxis, Tailwind no genera las reglas CSS para estas clases. Como resultado, el nodo `.sidebar-gap` (encargado de empujar el contenido principal en pantallas de escritorio) obtiene un `width: 0px`. 
   - *Consecuencia:* El sidebar (que posee `fixed inset-y-0`) se superpone al layout, cubriendo parcial o totalmente el inicio del contenido.

2. **Uso de `<main className="w-full">` en el `DashboardLayout`:**
   En `/app/(dashboard)/layout.tsx`, el contenedor principal se define como `<main className="w-full flex-1 ...">`. Al usarse `w-full` junto a un sidebar con posición fija (cuyo gap falló), el contenido principal abarca el `100vw` en lugar del espacio sobrante (`calc(100vw - 16rem)`).

## 2. Solución Propuesta (Jerarquía del DOM y Clases Tailwind)

Para garantizar un renderizado perfecto sin modificar la versión global de Tailwind, se debe refactorizar la jerarquía del DOM utilizando el componente nativo `<SidebarInset>` de Shadcn y aplicar parches de sintaxis a las clases v4 del sidebar.

### 2.1 Refactorización del Sidebar (Shadcn UI component)
Se debe modificar directamente el archivo `components/ui/sidebar.tsx` aplicando la sintaxis de variables CSS compatible con Tailwind v3:
- Reemplazar `w-(--sidebar-width)` por `w-[var(--sidebar-width)]`.
- Reemplazar `w-(--sidebar-width-icon)` por `w-[var(--sidebar-width-icon)]`.
- Reemplazar `w-(--skeleton-width)` por `w-[var(--skeleton-width)]`.
- Reemplazar los cálculos complejos como `w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]` por un valor estático seguro en v3: `w-[calc(var(--sidebar-width-icon)+1rem)]`.

### 2.2 Jerarquía del Layout (`app/(dashboard)/layout.tsx`)
Se debe reemplazar el contenedor `<main>` genérico por el componente `<SidebarInset>` diseñado para manejar correctamente las restricciones de `flex` y el margen del sidebar contraíble.

**DOM Target:**
```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        {/* REEMPLAZO: SidebarInset encapsula el flex, permitiendo que no colisione con el Sidebar fijo */}
        <SidebarInset className="flex-1 min-w-0 overflow-hidden flex flex-col h-screen">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

### 2.3 Command Center Header & Main Content
El contenedor interno debe mantenerse usando el alto completo asignado por el `SidebarInset`. Las clases `w-full` ahora son seguras porque actúan sobre el contenedor ya empujado por el *gap* del sidebar.

```tsx
// app/(dashboard)/command-center/page.tsx
<div className="flex flex-col h-full w-full bg-background">
  {/* El Header es ahora totalmente visible, empujado por la herencia flex */}
  <CommandCenterHeader />
  <div className="flex-1 overflow-hidden">
    <CommandCenterLayout />
  </div>
</div>
```

## 3. Plan de Acción (Dependencias para Ejecución)
El Gerente Teseo debe autorizar la siguiente secuencia para el `Ejecutor`:
1. Ejecutar el parcheo de sintaxis v4->v3 en `components/ui/sidebar.tsx`.
2. Reemplazar `<main>` por `<SidebarInset>` en `app/(dashboard)/layout.tsx`.
3. Validar con pruebas E2E o Tester visual que el `CommandCenterHeader` no quede bloqueado por el logo del sidebar y el Kanban se desplace correctamente a la derecha.
