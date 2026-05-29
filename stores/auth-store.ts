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
      // MOCK DEV BYPASS: Force active session in development
      operatorId: process.env.NODE_ENV === 'development' ? 'dev-operator-001' : null,
      activeTenantId: process.env.NODE_ENV === 'development' ? 'dev-tenant-001' : null,
      tenants: process.env.NODE_ENV === 'development' ? [
        { id: 'dev-tenant-001', name: 'Dev Tenant (Mock)', role: 'admin' },
        { id: 'comerseg', name: 'Comerseg (Mock)', role: 'admin' }
      ] : [],
      setOperatorId: (id) => set({ operatorId: id }),
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setTenants: (tenants) => set({ tenants }),
      clearAuth: () => set({ operatorId: null, activeTenantId: null, tenants: [] })
    }),
    { 
      name: 'teseo-auth-storage'
    }
  )
);
