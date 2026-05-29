import { test, expect } from '@playwright/test';

test('upload document and capture network', async ({ page }) => {
  await page.goto('http://localhost:3003/auth/login');
  await page.fill('input[name="email"]', 'e2e@teseo.lat');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  await page.goto('http://localhost:3003/asset-studio/documents');
  await page.waitForTimeout(3000);
  
  // Listen for the upload API call
  page.on('response', async (response) => {
    if (response.url().includes('/upload')) {
      console.log(`[NETWORK] ${response.url()} : ${response.status()}`);
      const body = await response.text();
      console.log(`[NETWORK BODY]`, body);
    }
  });

  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    console.log('Found file input, uploading...');
    await fileInput.setInputFiles('/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt');
  }

  await page.waitForTimeout(6000);
});
