const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:3003/auth/login');
  await page.fill('input[type="email"]', 'test@teseo.lat');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000); // Wait for potential error message
  const html = await page.content();
  if (html.includes('Credenciales inválidas') || html.includes('error') || html.includes('Error')) {
    console.log('Login failed with an error on screen.');
    // extract the text
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
  } else {
    console.log('No obvious error, did it navigate? URL:', page.url());
  }
  await browser.close();
})();
