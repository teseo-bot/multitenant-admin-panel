const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('response', resp => {
    if (!resp.ok()) console.log('FAILED URL:', resp.url(), resp.status());
  });
  await page.goto('http://localhost:3003/auth/login');
  await page.waitForTimeout(2000);
  await browser.close();
})();
