import { QueryClient } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,           // 30s — datos de inbox se consideran frescos
        refetchOnWindowFocus: true,      // Re-sync al volver a la tab
        retry: 2,
      },
    },
  });
}

// Singleton para SSR (evita recrear en cada request server-side)
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();            // Server: siempre nuevo
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;             // Browser: singleton
}
