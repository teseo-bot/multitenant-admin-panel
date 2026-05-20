const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3003/asset-studio/documents');
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: 'screenshot.png' });
  const html = await page.content();
  require('fs').writeFileSync('page.html', html);
  
  console.log("Screenshot and HTML saved.");
  await browser.close();
})();