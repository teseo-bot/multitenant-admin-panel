const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('API ERROR:', response.status(), response.url());
    }
  });

  await page.goto('http://localhost:3008/auth/login', { waitUntil: 'networkidle' });
  await page.waitForURL('**/command-center', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  await page.getByText('Bob Smith').first().click();
  await page.waitForTimeout(2000);

  await browser.close();
})();