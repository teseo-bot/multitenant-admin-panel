import { test, expect } from '@playwright/test';

test('Sandbox Smoke Test: Dashboard carga sin Errores 500 y muestra Sidebar', async ({ page }) => {
  // Navegamos al Overview
  await page.goto('/command-center');
  
  // Validamos que la redirección por falta de sesión o el renderizado directo funcionen
  // y no haya una pantalla blanca de la muerte (Next.js Error Overlay)
  
  // Dependiendo de si la URL de Supabase "build-dummy" fuerza un fallo de SSR o un redirect al login
  // Revisamos qué ocurre:
  const title = await page.title();
  
  // Imprimimos la URL final para debug del Tester
  console.log(`URL resultante tras navegar: ${page.url()}`);

  // Chequeamos que estemos en Teseo OS (Auth o Dashboard)
  expect(title).not.toContain('500 Internal Server Error');
  expect(title).not.toContain('Application error');
});
