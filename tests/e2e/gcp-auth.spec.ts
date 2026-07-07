import { test, expect } from '@playwright/test';

/**
 * GCP Auth (Firebase) Login E2E Tests
 *
 * PENDING EXECUTION: These tests require:
 * 1. A test user created in Identity Platform (micontexto-control)
 * 2. The dev server running locally (npm run dev)
 *
 * Test user credentials should be set via environment variables:
 * - TEST_USER_EMAIL
 * - TEST_USER_PASSWORD
 *
 * Run with: npx playwright test tests/e2e/gcp-auth.spec.ts
 */

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Test123!@#';

test.describe('GCP Auth - Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/auth/login');
  });

  test('successfully login with valid credentials and redirect to dashboard', async ({ page }) => {
    // Fill in email and password
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/admin/users', { timeout: 5000 });

    // Verify we are on the dashboard
    expect(page.url()).toContain('/admin/users');

    // Verify session cookie is set (check in cookies)
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(true);
  });

  test('display "Correo o contraseña incorrectos." for invalid password', async ({ page }) => {
    // Fill in email with valid format but wrong password
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', 'WrongPassword123!@#');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait a bit for error to appear
    await page.waitForTimeout(1000);

    // Check error message is visible
    const errorMessage = await page.locator('text="Correo o contraseña incorrectos."').isVisible();
    expect(errorMessage).toBe(true);

    // Verify we are still on login page
    expect(page.url()).toContain('/auth/login');
  });

  test('display session expired banner when reason=expired query param is present', async ({ page }) => {
    // Navigate to login page with reason=expired
    await page.goto('/auth/login?reason=expired');

    // Verify the expired session banner is visible
    const banner = await page.locator('text="Tu sesión expiró. Vuelve a entrar."').isVisible();
    expect(banner).toBe(true);
  });

  test('disable submit button and show spinner while loading', async ({ page }) => {
    // Fill in form
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);

    // Click submit button
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Button should be disabled (will re-enable after response or error)
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Spinner should be visible
    const spinner = await page.locator('svg.animate-spin').first().isVisible();
    expect(spinner).toBe(true);
  });

  test('display "Tu cuenta está desactivada..." for disabled user account', async ({ page }) => {
    // This test assumes a disabled test user exists
    // Fill in credentials of a disabled account
    await page.fill('input[name="email"]', 'disabled@example.com');
    await page.fill('input[name="password"]', 'Password123!@#');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error
    await page.waitForTimeout(1000);

    // Check for disabled account error message
    const errorMessage = await page.locator('text="Tu cuenta está desactivada. Contacta al administrador."').isVisible();
    expect(errorMessage).toBe(true);
  });

  test('display "No se pudo conectar..." for network errors', async ({ page, context }) => {
    // Simulate network error by going offline
    await context.setOffline(true);

    // Fill in form
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error
    await page.waitForTimeout(1500);

    // Check for network error message
    const errorMessage = await page.locator('text="No se pudo conectar. Intenta de nuevo."').isVisible();
    expect(errorMessage).toBe(true);

    // Restore connection
    await context.setOffline(false);
  });

  test('display "Demasiados intentos..." after too many login attempts', async ({ page }) => {
    // This test requires rapid-fire failed attempts to trigger Firebase rate limiting
    // Try multiple times in succession
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', TEST_USER_EMAIL);
      await page.fill('input[name="password"]', 'WrongPassword123!@#');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // After multiple failures, should see rate limit message
    await page.waitForTimeout(1000);
    const errorMessage = await page.locator('text="Demasiados intentos. Espera unos minutos."').isVisible();
    expect(errorMessage).toBe(true);
  });

  test('persist session cookie after successful login', async ({ page }) => {
    // Login successfully
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('/admin/users');

    // Get cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');

    // Verify session cookie properties
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
  });

  test('redirect to login when accessing protected route without session', async ({ page }) => {
    // Try to navigate directly to protected route without session
    await page.goto('/admin/users', { waitUntil: 'networkidle' });

    // Should be redirected to login with reason=expired
    expect(page.url()).toContain('/auth/login');
    expect(page.url()).toContain('reason=expired');
  });

  test('redirect authenticated user from login page to dashboard', async ({ page }) => {
    // First login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/admin/users');

    // Now try to access login page while authenticated
    await page.goto('/auth/login');

    // Should redirect back to dashboard
    await page.waitForURL('/admin/users');
    expect(page.url()).toContain('/admin/users');
  });
});
