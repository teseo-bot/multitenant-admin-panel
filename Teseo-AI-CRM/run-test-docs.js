const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let status = 'PASS';
  
  try {
    console.log('Navigating...');
    await page.goto('http://localhost:3003/asset-studio/documents', { waitUntil: 'domcontentloaded' });
    
    await page.waitForTimeout(2000);
    
    if (page.url().includes('login')) {
      console.log('Logging in...');
      await page.fill('input[type="email"]', 'test@teseo.lat');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      
      console.log('Waiting for redirect...');
      await page.waitForURL('**/asset-studio/documents**', { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    
    console.log(`Current URL: ${page.url()}`);
    
    console.log('Uploading file...');
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      console.log('No visible file input, clicking any Upload/Add button...');
      const uploadBtn = await page.$('button:has-text("Upload"), button:has-text("Add"), button:has-text("New")');
      if (uploadBtn) {
        await uploadBtn.click();
        await page.waitForTimeout(1000);
        fileInput = await page.$('input[type="file"]');
      }
    }

    if (fileInput) {
      console.log('Attaching file...');
      await fileInput.setInputFiles('/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt');
    } else {
      throw new Error('Could not find file input element.');
    }

    console.log('Wait for processing/ready state...');
    // The upload might require clicking a submit button after choosing the file
    const submitUpload = await page.$('button:has-text("Submit"), button:has-text("Save"), button:has-text("Confirm")');
    if (submitUpload) {
      console.log('Found a submit/save button in the upload dialog, clicking it...');
      await submitUpload.click();
    }
    
    await page.waitForTimeout(2000);
    
    await page.waitForSelector('text="processing"', { timeout: 5000 }).catch(async () => {
      console.log('Did not find "processing" quickly, looking for other success texts...');
      await page.waitForSelector('text="ready", text="Processing", text="Ready", text="Success", text="uploaded"', { timeout: 10000 });
    });
    console.log('Upload state found in DOM.');
    
  } catch (error) {
    console.error(`Error during test: ${error.message}`);
    status = 'FAIL';
  } finally {
    await page.screenshot({ path: '/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/documents-test-result.png' });
    await browser.close();
    console.log(`\nFinal result: ${status}`);
  }
})();
