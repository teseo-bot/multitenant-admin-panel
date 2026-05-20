# RFC 054: Soporte Front-End Tenant OS - Integración de Tenant Switcher

## 1. Resumen Ejecutivo
Este documento describe el diseño técnico para la integración del modelo Multi-Tenant ("Tenant OS") en el frontend de Teseo-AI-CRM (`crm-agentico-panel`). El objetivo es dotar a la UI de un componente para alternar entre espacios de trabajo (inquilinos) y asegurar que todas las peticiones HTTP subsiguientes estén aisladas y validadas contra dicho inquilino mediante la cabecera `x-tenant-id`, alineándose con la arquitectura Zero-Trust del backend.

## 2. Gestión de Estado Global (Zustand)
Actualmente, el frontend utiliza Zustand en `stores/auth-store.ts`. Se propone extender la interfaz actual para manejar la lista de inquilinos autorizados para la sesión actual y el inquilino activo.

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  operatorId: string | null;
  activeTenantId: string | null;
  tenants: Tenant[];
  setOperatorId: (id: string) => void;
  setActiveTenantId: (id: string) => void;
  setTenants: (tenants: Tenant[]) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      operatorId: null,
      activeTenantId: null,
      tenants: [],
      setOperatorId: (id) => set({ operatorId: id }),
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setTenants: (tenants) => set({ tenants }),
      clearAuth: () => set({ operatorId: null, activeTenantId: null, tenants: [] })
    }),
    { name: 'teseo-auth-storage' }
  )
);
```

## 3. Diseño del Componente `TenantSwitcher`
El componente `TenantSwitcher` se ubicará en la barra de navegación superior o sidebar. 

**Comportamiento:**
1. Leerá `tenants` y `activeTenantId` de `useAuthStore`.
2. Presentará un `DropdownMenu` o `Select` (shadcn/ui) con la lista de inquilinos.
3. Al cambiar de inquilino:
   - Actualizará el estado en Zustand (`setActiveTenantId`).
   - Disparará una invalidación global de la caché en React Query (`queryClient.invalidateQueries()`) para forzar la recarga de la información del dashboard y listas asociadas al nuevo inquilino.

```tsx
// components/tenant-switcher.tsx
import { useAuthStore } from '@/stores/auth-store';
import { useQueryClient } from '@tanstack/react-query';
// + importaciones UI (Select/Dropdown)

export function TenantSwitcher() {
  const { tenants, activeTenantId, setActiveTenantId } = useAuthStore();
  const queryClient = useQueryClient();

  const handleTenantChange = (tenantId: string) => {
    setActiveTenantId(tenantId);
    // Invalidar queries para purgar la data del tenant anterior
    queryClient.invalidateQueries(); 
  };

  if (!tenants || tenants.length === 0) return null;

  return (
    <Select value={activeTenantId || ''} onValueChange={handleTenantChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Seleccionar Entorno" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map(t => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

## 4. Mecanismo de Intercepción HTTP
El análisis del repositorio (`hooks/queries` y `hooks/mutations`) revela un alto acoplamiento con la API nativa `fetch`. Para implementar el paso de la cabecera `x-tenant-id` sin refactorizar exhaustivamente cada llamada o arriesgar omisiones, se implementará un Wrapper de Fetch (`lib/api-client.ts`). 

```typescript
// lib/api-client.ts
import { useAuthStore } from '@/stores/auth-store';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { activeTenantId } = useAuthStore.getState();
  
  const headers = new Headers(init?.headers);
  if (activeTenantId) {
    headers.set('x-tenant-id', activeTenantId);
  }

  // Opcional: inyectar el Authorization header si fuera necesario (JWT)
  
  return fetch(input, {
    ...init,
    headers,
  });
}
```

**Estrategia de Adopción:**
- Modificar los hooks de `@tanstack/react-query` (ej. `use-leads.ts`, `use-campaigns.ts`) para reemplazar la llamada nativa `fetch` por `apiFetch`.
- Al inyectar el `x-tenant-id`, las rutas de Next.js (`app/api/*`) podrán extraer la cabecera mediante `request.headers.get('x-tenant-id')` y utilizarla para instanciar el cliente de base de datos (Supabase) con RLS o forwardearla al Gateway en microservicios.

## 5. Próximos Pasos
1. Modificar `stores/auth-store.ts` para incluir la persistencia y la gestión de la lista de Tenants.
2. Crear `components/tenant-switcher.tsx` e integrarlo al layout principal.
3. Crear `lib/api-client.ts`.
4. Refactorizar los queries y mutations para usar `apiFetch`.
5. Ajustar el endpoint de inicio de sesión (`/api/auth/login` o similar) para que retorne la lista de inquilinos autorizados para el usuario, poblando el estado en Zustand en el momento del login.
