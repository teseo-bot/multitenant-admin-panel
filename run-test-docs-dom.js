const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3003/auth/login');
  const html = await page.content();
  console.log(html);
  await browser.close();
})();
