const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  console.log('Navigating to http://localhost:3003...');
  await page.goto('http://localhost:3003/command-center', { waitUntil: 'networkidle' });
  
  // Wait a bit to see if React crashes and displays a White Screen of Death (usually an empty #root or __next)
  await page.waitForTimeout(3000);
  
  const content = await page.content();
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  
  console.log('Title:', title);
  console.log('Body length:', bodyText.length);
  if (bodyText.length < 50) {
    console.log('Warning: Body text is very short, possible WSOD.');
  }
  
  if (errors.length > 0) {
    console.log('Console Errors found:');
    errors.forEach(e => console.log(' - ' + e));
  } else {
    console.log('No console errors found!');
  }
  
  await browser.close();
})();
