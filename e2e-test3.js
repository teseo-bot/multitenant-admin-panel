const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('API ERROR:', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:3008/command-center', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  await browser.close();
})();