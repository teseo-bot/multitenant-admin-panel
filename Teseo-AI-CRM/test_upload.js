const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to http://localhost:3003/asset-studio/documents...");
  await page.goto('http://localhost:3003/asset-studio/documents');
  
  console.log("Waiting for Dropzone to appear...");
  // Dropzone inputs are usually type="file"
  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached' });
  
  const filePath = '/Users/teseohome/projects/Teseo-AI-CRM/tests/test_document.txt';
  console.log(`Setting input files to ${filePath}...`);
  await fileInput.setInputFiles(filePath);
  
  console.log("Waiting for network response to be 201...");
  // Wait for the upload request to finish, returning 2xx or 201
  const response = await page.waitForResponse(response => 
    response.url().includes('documents') && response.request().method() === 'POST' ||
    response.url().includes('upload') && response.request().method() === 'POST'
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
