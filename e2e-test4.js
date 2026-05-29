const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));

  console.log("Navigating to /auth/login...");
  await page.goto('http://localhost:3008/auth/login', { waitUntil: 'networkidle' });
  
  // Wait for redirect to /command-center
  await page.waitForURL('**/command-center', { timeout: 10000 }).catch(e => console.log("Did not redirect within 10s"));
  console.log("Current URL:", page.url());
  
  await page.waitForTimeout(3000);
  
  const leads = await page.locator('body').innerText();
  if (leads.includes('Alice Johnson') || leads.includes('Bob Smith') || leads.includes('Charlie Brown')) {
    console.log("Leads rendered successfully.");
    const names = await page.locator('div').filter({ hasText: /Alice Johnson|Bob Smith|Charlie Brown/ }).allInnerTexts();
    console.log("Found texts containing leads:", names.length);
  } else {
    console.log("Leads not found in body text.");
    console.log("Body text sample:", leads.slice(0, 500));
  }

  // Find Bob Smith and click him
  try {
    console.log("Clicking Bob Smith...");
    await page.getByText('Bob Smith').first().click();
    await page.waitForTimeout(2000);
    const bodyAfterClick = await page.locator('body').innerText();
    if (bodyAfterClick.includes('Inbox') && bodyAfterClick.includes('Bob Smith')) {
       console.log("Inbox loaded for Bob Smith.");
    }
  } catch (err) {
    console.log("Error clicking Bob Smith:", err.message);
  }

  await browser.close();
})();