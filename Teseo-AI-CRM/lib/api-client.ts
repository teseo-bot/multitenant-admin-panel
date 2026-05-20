import { useAuthStore } from '../stores/auth-store';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { activeTenantId, tenants } = useAuthStore.getState();
  
  const headers = new Headers(init?.headers);
  if (activeTenantId) {
    const isValidTenant = tenants.some(t => t.id === activeTenantId);
    if (!isValidTenant) {
      throw new Error('Unauthorized: Invalid tenant ID');
    }
    headers.set('x-tenant-id', activeTenantId);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
