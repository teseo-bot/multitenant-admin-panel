const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5175/command-center', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'cc-screenshot.png' });
  await browser.close();
})();
