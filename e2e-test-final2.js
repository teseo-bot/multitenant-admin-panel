const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/api/')) {
      console.log('API ERROR:', response.status(), response.url());
    } else if (response.status() === 200 && response.url().includes('/api/leads/update-order')) {
      console.log('API SUCCESS:', response.status(), response.url());
    }
  });

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3009/auth/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Find Bob Smith and click him
  console.log("Clicking Bob Smith to open Inbox...");
  const bobs = await page.getByText('Bob Smith');
  if (await bobs.count() > 0) {
    await bobs.first().click();
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('Bob Smith')) {
      console.log("Inbox loaded for Bob Smith.");
    }
  }

  // Check update-order API
  console.log("Testing /api/leads/update-order directly via fetch...");
  const apiTestResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/leads/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: 'some-id', sort_order: 1 }] })
      });
      return res.status;
    } catch(e) {
      return e.message;
    }
  });
  console.log("Direct API update-order test status:", apiTestResult);

  await browser.close();
})();