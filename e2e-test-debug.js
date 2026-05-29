const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3009/auth/login', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(5000);
  console.log("Current URL after 5s:", page.url());
  
  // Also dump body
  console.log("Body:", await page.locator('body').innerText());

  await browser.close();
})();