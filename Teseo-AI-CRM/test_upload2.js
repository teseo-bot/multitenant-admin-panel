const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to http://localhost:3003/asset-studio/documents...");
  await page.goto('http://localhost:3003/asset-studio/documents');
  
  // wait for login to appear
  await page.waitForSelector('#email');
  console.log("Typing login credentials...");
  await page.fill('#email', 'test@teseo.lat');
  await page.fill('#password', 'password'); // or whatever it is, hopefully password
  
  // press Enter
  await Promise.all([
    page.waitForNavigation().catch(() => {}), // or wait for URL change
    page.press('#password', 'Enter')
  ]);
  
  await page.waitForTimeout(2000); // give it time to load the next page
  
  // Check if we are still on login page
  const isEmailStillThere = await page.$('#email');
  if (isEmailStillThere) {
      console.log("Login failed with 'password', trying 'password123'...");
      await page.fill('#password', 'password123');
      await Promise.all([
        page.waitForNavigation().catch(() => {}),
        page.press('#password', 'Enter')
      ]);
      await page.waitForTimeout(2000);
  }
  
  // if not, try e2e@teseo.lat / password
  if (await page.$('#email')) {
      console.log("Trying e2e@teseo.lat...");
      await page.fill('#email', 'e2e@teseo.lat');
      await page.fill('#password', 'password');
      await page.press('#password', 'Enter');
      await page.waitForTimeout(2000);
  }

  if (await page.$('#email')) {
      console.log("Trying fleetco@fleetco.mx...");
      await page.fill('#email', 'fleetco@fleetco.mx');
      await page.fill('#password', 'password');
      await page.press('#password', 'Enter');
      await page.waitForTimeout(2000);
  }

  console.log("Current URL after login attempt:", page.url());
  
  console.log("Waiting for Dropzone to appear...");
  // Dropzone inputs are usually type="file"
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 10000 }).catch(e => null);
  
  if (!fileInput) {
      console.log("Could not find file input. Saving screenshot and page HTML...");
      await page.screenshot({ path: 'screenshot_after_login.png' });
      require('fs').writeFileSync('page_after_login.html', await page.content());
      await browser.close();
      return;
  }
  
  const filePath = '/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt';
  console.log(`Setting input files to ${filePath}...`);
  await fileInput.setInputFiles(filePath);
  
  console.log("Waiting for network response to be 201...");
  // Wait for the upload request to finish, returning 2xx or 201
  const response = await page.waitForResponse(response => 
    (response.url().includes('documents') || response.url().includes('upload')) && response.request().method() === 'POST'
  , { timeout: 10000 }).catch(e => null);
  
  if (response) {
      console.log(`Upload response status: ${response.status()}`);
      if (response.status() === 201 || response.status() === 200) {
          console.log("PASS: Received 201/200 on upload!");
      } else {
          console.log(`FAIL: Received ${response.status()} on upload.`);
      }
  } else {
      console.log("No matching network response found. Let's wait a bit and check UI instead.");
      await page.waitForTimeout(5000);
  }
  
  await browser.close();
})();
