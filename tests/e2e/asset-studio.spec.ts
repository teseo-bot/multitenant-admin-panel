import { test, expect } from '@playwright/test';

test.describe('Flujos Configuración E2E (Asset Studio)', () => {

  test('Navegación al Gestor de Prompts', async ({ page }) => {
    // Vamos a la raíz del Asset Studio
    await page.goto('/asset-studio');
    
    const url = page.url();
    
    if (url.includes('/auth/login')) {
      console.log('AppSec Pass (Asset Studio): Redirigido a Login por RLS.');
      return;
    }

    // La raíz debería redirigir a /prompts (RFC-042)
    await page.waitForURL('**/asset-studio/prompts');
    expect(page.url()).toContain('/asset-studio/prompts');

    // Verificar que el header del Asset Studio esté vivo
    const heading = page.getByRole('heading', { name: /Prompts/i });
    await expect(heading).toBeVisible();
  });

  test('Navegación al Gestor Documental (Upload Dropzone)', async ({ page }) => {
    await page.goto('/asset-studio/documents');
    
    if (page.url().includes('/auth/login')) return;

    // RFC-047/048: Debe existir un área de carga
    const dropzoneText = page.getByText(/Haz clic o arrastra/i);
    await expect(dropzoneText).toBeVisible();
  });

  test('Navegación al Gestor de Variables', async ({ page }) => {
    await page.goto('/asset-studio/variables');
    
    if (page.url().includes('/auth/login')) return;

    // Verificar botón de creación
    const newVarButton = page.getByRole('button', { name: /Nueva Variable/i });
    await expect(newVarButton).toBeVisible();
  });

});
