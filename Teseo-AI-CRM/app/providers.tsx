'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

if (typeof window !== 'undefined' && !('__fetchPatched' in window)) {
  Object.defineProperty(window, '__fetchPatched', { value: true, writable: false });
  const originalFetch = window.fetch;
  window.fetch = async (resource: RequestInfo | URL, config?: RequestInit) => {
    let url = '';
    if (typeof resource === 'string') {
      url = resource;
    } else if (resource instanceof URL) {
      url = resource.toString();
    } else if (resource instanceof Request) {
      url = resource.url;
    }

    let finalResource = resource;
    let finalConfig = config;

    if (url.includes('/api/')) {
      const { activeTenantId, tenants } = useAuthStore.getState();
      
      if (activeTenantId) {
        const isValidTenant = tenants.some(t => t.id === activeTenantId);
        if (!isValidTenant) {
          throw new Error('Unauthorized: Invalid tenant ID');
        }

        if (finalResource instanceof Request) {
          const headers = new Headers(finalResource.headers);
          headers.set('x-tenant-id', activeTenantId);
          finalResource = new Request(finalResource, { headers });
        } else {
          finalConfig = finalConfig || {};
          const headers = new Headers(finalConfig.headers);
          headers.set('x-tenant-id', activeTenantId);
          finalConfig.headers = headers;
        }
      }
    }

    return originalFetch(finalResource, finalConfig);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
