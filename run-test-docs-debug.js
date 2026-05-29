const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3003/auth/login');
  await page.fill('input[type="email"]', 'test@teseo.lat');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const html = await page.content();
  console.log('Current URL:', page.url());
  console.log('DOM length:', html.length);
  if (html.includes('Credenciales') || html.includes('error')) {
    console.log('Found error text in DOM.');
  }
  await page.screenshot({ path: '/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/debug-login.png' });
  await browser.close();
})();
