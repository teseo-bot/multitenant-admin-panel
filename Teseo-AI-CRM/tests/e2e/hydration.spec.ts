import { test, expect } from '@playwright/test';

const urlsToTest = ['/dashboard', '/cartera', '/actividades'];

test.describe('Hydration and Async Data Rendering', () => {
  let hydrationErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    hydrationErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          text.includes('Hydration failed') ||
          text.includes('Text content does not match server-rendered HTML') ||
          text.includes('There was an error while hydrating') ||
          text.includes('Minified React error #418') ||
          text.includes('Minified React error #423') ||
          text.includes('Minified React error #425')
        ) {
          hydrationErrors.push(text);
          console.log('[ERROR] Hydration issue detected:', text);
        }
      }
    });

    await page.goto('http://localhost:3003/auth/login');
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@teseo.lat');
      await page.locator('input[name="password"]').fill('password123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
      console.log('Login submitted.');
    }
  });

  for (const path of urlsToTest) {
    test(`Validates hydration and rendering for ${path}`, async ({ page }) => {
      console.log(`Navigating to http://localhost:3003${path}`);
      await page.goto(`http://localhost:3003${path}`);
      await page.waitForLoadState('networkidle');
      
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`Final URL is ${currentUrl}`);
      // If it redirected to login, login failed or no session
      expect(currentUrl).toContain(path);

      console.log(`Checking hydration errors for ${path}...`);
      expect(hydrationErrors, `Hydration errors found on ${path}: \n${hydrationErrors.join('\n')}`).toHaveLength(0);

      const title = await page.title();
      expect(title).not.toContain('500 Internal Server Error');
      expect(title).not.toContain('Application error');

      const bodyText = await page.innerText('body');
      expect(bodyText.length).toBeGreaterThan(50);
      expect(bodyText).not.toContain('Application error: a client-side exception has occurred');
    });
  }
});
