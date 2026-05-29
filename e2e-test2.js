const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.log('NETWORK FAILED:', request.url(), request.failure().errorText));

  console.log("Navigating to http://localhost:3008/command-center...");
  await page.goto('http://localhost:3008/command-center', { waitUntil: 'networkidle' });
  
  await page.waitForTimeout(5000);
  
  const bodyText = await page.locator('body').innerText();
  console.log("Body text:\n", bodyText);
  
  if (bodyText.includes('Sign In') || bodyText.includes('Log In')) {
    console.log("Looks like we need to login.");
  }
  
  const leads = await page.locator('div, span, h3').filter({ hasText: /Alice Johnson|Bob Smith|Charlie Brown/ }).allInnerTexts();
  console.log("Found leads:", leads);

  await browser.close();
})();