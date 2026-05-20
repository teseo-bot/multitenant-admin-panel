const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3003/asset-studio/documents');
  await page.waitForSelector('#email');
  await page.fill('#email', 'test@teseo.lat');
  await page.fill('#password', 'password123');
  await Promise.all([
    page.waitForNavigation().catch(() => {}),
    page.press('#password', 'Enter')
  ]);
  await page.waitForTimeout(2000);
  
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  const filePath = '/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt';
  
  // hook into the response
  page.on('response', async (response) => {
      if ((response.url().includes('documents') || response.url().includes('upload')) && response.request().method() === 'POST') {
          console.log(`\n\n--- Network Response ---`);
          console.log(`URL: ${response.url()}`);
          console.log(`Status: ${response.status()}`);
          try {
              const body = await response.text();
              console.log(`Body: ${body}`);
          } catch(e) {}
      }
  });

  await fileInput.setInputFiles(filePath);
  
  // wait a bit
  await page.waitForTimeout(5000);
  await browser.close();
})();
