const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3003/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // Wait for hydration!
  await page.fill('input[type="email"]', 'test@teseo.lat');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  console.log('Current URL:', page.url());
  await browser.close();
})();
