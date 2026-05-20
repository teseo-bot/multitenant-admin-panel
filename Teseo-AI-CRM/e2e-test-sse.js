const { chromium } = require('playwright');

(async () => {
  let has500 = false;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('500')) {
      has500 = true;
    }
    console.log('BROWSER CONSOLE:', msg.type(), msg.text());
  });
  
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      console.log('API ERROR:', response.status(), response.url());
      if (response.status() === 500) has500 = true;
    }
  });

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3009/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log("Clicking Bob Smith to open Inbox...");
  const bobs = await page.getByText('Bob Smith');
  if (await bobs.count() > 0) {
    await bobs.first().click();
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('Bob Smith') && bodyText.includes('Inbox')) {
      console.log("Inbox loaded for Bob Smith.");
    }
  }

  if (has500) {
    console.log("Verdict: FAIL - 500 error encountered.");
  } else {
    console.log("Verdict: PASS - No 500 errors, SSE connected successfully.");
  }

  await browser.close();
})();