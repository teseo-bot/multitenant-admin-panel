const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5175/command-center', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); 

  console.log("Current URL:", page.url());
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Page Text:", text.substring(0, 500));
  
  const hasHeader = await page.evaluate(() => !!document.querySelector('header') || document.body.innerText.includes('Command Center'));
  const hasKanban = text.toLowerCase().includes("kanban");
  const hasInbox = text.toLowerCase().includes("inbox");
  
  console.log("--- RESULTS ---");
  console.log("Has Header:", hasHeader);
  console.log("Has Kanban:", hasKanban);
  console.log("Has Inbox:", hasInbox);

  await browser.close();
})();
