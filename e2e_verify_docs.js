const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let uploadStatus = null;
  
  page.on('response', async (response) => {
    if (response.url().includes('/api/asset-studio/documents/upload') && response.request().method() === 'POST') {
      uploadStatus = response.status();
      console.log(`[Network] POST /api/asset-studio/documents/upload returned: ${uploadStatus}`);
    }
  });

  try {
    console.log("1. Navegando a asset-studio/documents...");
    await page.goto('http://localhost:3003/asset-studio/documents');
    
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      console.log("   Requiere login. Ingresando credenciales...");
      await page.fill('input[type="email"]', 'test@teseo.lat');
      await page.fill('input[type="password"]', 'password123');
      await page.press('input[type="password"]', 'Enter');
      await page.waitForURL('**/asset-studio/documents', { timeout: 10000 });
      console.log("   Login exitoso.");
    }
    
    console.log("2. Buscando el componente Dropzone...");
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 });
    
    if (!fileInput) {
      throw new Error("No se encontró input[type='file'] de Dropzone.");
    }

    console.log("3. Subiendo archivo test_document.txt...");
    const filePath = '/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt';
    await fileInput.setInputFiles(filePath);
    
    // Esperar a que la petición de subida termine y la tabla se actualice
    await page.waitForTimeout(6000);
    
    await page.screenshot({ path: 'documents-test-result-final.png', fullPage: true });
    console.log("   Screenshot guardado en documents-test-result-final.png");

  } catch (error) {
    console.error("Error durante E2E de Playwright:", error);
  } finally {
    await browser.close();
  }
})();
