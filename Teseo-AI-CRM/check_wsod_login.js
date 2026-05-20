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

  console.log('Navigating to login...');
  await page.goto('http://localhost:3003/auth/login', { waitUntil: 'networkidle' });
  
  await page.fill('input[type="email"]', 'test@teseo.lat'); // wait, try admin or test
  await page.fill('input[type="password"]', 'password123'); // guessing
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(2000);
  
  console.log('Navigating to command center...');
  await page.goto('http://localhost:3003/command-center', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  
  console.log('Title:', title);
  console.log('Body length:', bodyText.length);
  console.log('First 100 chars of body:', bodyText.substring(0, 100).replace(/\n/g, ' '));
  
  if (errors.length > 0) {
    console.log('Console Errors found:');
    errors.forEach(e => console.log(' - ' + e));
  } else {
    console.log('No console errors found!');
  }
  
  await browser.close();
})();
