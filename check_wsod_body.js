const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3003', { waitUntil: 'networkidle' });
  const bodyText = await page.locator('body').innerText();
  console.log('Index Body:', bodyText);
  await browser.close();
})();
