import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Solo los tests escritos para vitest. El resto de la suite (Knowledge Lab /
    // aliados) usa node:test y corre con `npm run test:node` (tsx --test) — si
    // vitest los recogiera fallarían con "No test suite found".
    // ⚠️ Lista explícita, igual que `test:node` en package.json: un *.test.ts que no esté en
    // ninguna de las dos NO LO CORRE NADIE, y la suite reporta verde. Al añadir un test,
    // registrarlo aquí o allá en el mismo commit.
    include: [
      '__tests__/components/tenant-switcher.test.tsx',
      '__tests__/lib/api-client.test.ts',
      'lib/services/membership.test.ts',
      'lib/tenants/tenant-idp.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/src/orchestrator/**'
    ],
  },
});
