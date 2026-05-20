const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to http://localhost:3008...");
  await page.goto('http://localhost:3008', { waitUntil: 'networkidle' });
  
  // Wait a bit
  await page.waitForTimeout(2000);
  
  // Check the current URL and page content
  const url = page.url();
  console.log("Current URL:", url);
  
  // Take a look at the HTML
  const content = await page.content();
  if (content.includes('Sign in') || content.includes('Login') || content.includes('Email') || content.includes('Password')) {
    console.log("Login screen detected.");
    // Try to login
    await page.fill('input[type="email"], input[name="email"]', 'qa@teseo.lat');
    await page.fill('input[type="password"], input[name="password"]', 'password123'); // Guessing the password, maybe we should check if qa@teseo.lat exists in DB first
    await page.click('button[type="submit"], button:has-text("Sign in")');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log("URL after login:", page.url());
  }

  // Navigate to /command-center if not already there
  if (!page.url().includes('/command-center')) {
    console.log("Navigating to /command-center...");
    await page.goto('http://localhost:3008/command-center', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }
  
  console.log("Current URL:", page.url());
  const bodyText = await page.locator('body').innerText();
  console.log("Body text fragment:", bodyText.slice(0, 500));

  await browser.close();
})();
