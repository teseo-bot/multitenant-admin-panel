const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3003/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'test@teseo.lat');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(2000);
  
  await page.goto('http://localhost:3003/command-center', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/Users/teseohome/projects/Teseo-AI-CRM/docs/qa_dashboard.png', fullPage: true });
  console.log('Screenshot saved to docs/qa_dashboard.png');
  await browser.close();
})();
