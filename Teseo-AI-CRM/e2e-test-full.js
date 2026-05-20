const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      console.log('API ERROR:', response.status(), response.url());
    } else if (response.status() === 200 && response.url().includes('/api/leads')) {
      console.log('API SUCCESS:', response.status(), response.url());
    }
  });

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3009/auth/login', { waitUntil: 'networkidle' });
  await page.waitForURL('**/command-center', { timeout: 10000 }).catch(() => {});
  console.log("Current URL:", page.url());
  
  await page.waitForTimeout(3000);
  
  // Try to find the draggable elements
  const bobs = await page.getByText('Bob Smith');
  const alices = await page.getByText('Alice Johnson');
  
  if (await bobs.count() > 0 && await alices.count() > 0) {
    console.log("Found leads. Attempting drag and drop...");
    await bobs.first().dragTo(alices.first());
    console.log("Drag & Drop executed.");
    await page.waitForTimeout(2000);
  }

  // Find Bob Smith and click him
  console.log("Clicking Bob Smith to open Inbox...");
  await bobs.first().click();
  await page.waitForTimeout(3000);
  
  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('Bob Smith')) {
    console.log("Inbox loaded for Bob Smith.");
  }
  
  // Look for any errors indicating SSE hook issues
  // The SSE route would have logged an error if it failed.
  await browser.close();
})();