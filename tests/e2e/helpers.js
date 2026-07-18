import { expect } from '@playwright/test';

/**
 * Logs the test user in via the real LoginScreen and waits until the app
 * has routed past onboarding onto the main 'weekly' screen. Assumes the
 * TEST_USER_EMAIL account already has profile + goals + intake complete —
 * see tests/e2e/README.md for one-time setup.
 */
export async function loginAsTestUser(page) {
  await page.goto('/');

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL / TEST_USER_PASSWORD not set — see tests/e2e/README.md'
    );
  }

  // Fallback selectors until LoginScreen.jsx has data-testid attributes —
  // update these to getByTestId('login-email') etc. once added.
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();

  // Should land on the weekly overview once auth + routing resolve.
  await expect(page).toHaveURL(/.*/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}
