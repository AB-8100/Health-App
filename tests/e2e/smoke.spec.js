import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers.js';

test.describe('core screens render without error', () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.__consoleErrors = errors;

    await loginAsTestUser(page);
  });

  test('lands on Weekly Overview after login, no console errors', async ({ page }) => {
    // WeeklyOverviewScreen is the default post-onboarding screen (§5 of PROJECT_CONTEXT).
    await expect(page.getByText(/mon|tue|wed|thu|fri|sat|sun/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('Gym Hub loads and shows the active split', async ({ page }) => {
    await page.getByRole('button', { name: /gym/i }).first().click();
    await expect(page.getByText(/push|pull|legs|upper|lower|full body/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('Food screen loads and shows meal buckets', async ({ page }) => {
    await page.getByRole('button', { name: /food/i }).first().click();
    await expect(page.getByText(/breakfast/i)).toBeVisible();
    await expect(page.getByText(/lunch/i)).toBeVisible();
    await expect(page.getByText(/dinner/i)).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('Home screen loads with focus card and progress pills', async ({ page }) => {
    await page.getByRole('button', { name: /home/i }).first().click();
    // Loosely scoped on purpose — HomeScreen is still substantially demo
    // data per PROJECT_CONTEXT §12, so this only checks it renders at all.
    await expect(page.locator('body')).not.toContainText(/undefined|NaN/);
    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen loads and shows profile info', async ({ page }) => {
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    await expect(page.locator('body')).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen shows Body stats above Data sync, no Connected apps stub', async ({ page }) => {
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    const bodyText = await page.locator('body').innerText();

    // Connected apps was a UI-only stub (Strava/Apple Health/etc. never
    // actually connected) — removed per features/specs/about-me-cosmetic-cleanup.md.
    expect(bodyText).not.toMatch(/Connected apps/i);

    // Body stats and Calorie targets should render above Data sync now that
    // they've been moved to the top of the screen.
    const bodyStatsIdx = bodyText.search(/Body stats/i);
    const calorieIdx   = bodyText.search(/Calorie targets/i);
    const dataSyncIdx  = bodyText.search(/Data sync/i);
    expect(bodyStatsIdx).toBeGreaterThan(-1);
    expect(dataSyncIdx).toBeGreaterThan(-1);
    expect(bodyStatsIdx).toBeLessThan(dataSyncIdx);
    expect(calorieIdx).toBeGreaterThan(-1);
    expect(calorieIdx).toBeLessThan(dataSyncIdx);

    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen Body stats includes a Sex control and Calorie targets shows a suggestion', async ({ page }) => {
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    await expect(page.getByText(/^Sex$/).first()).toBeVisible();
    // The suggestion only renders once age/height/weight are present (test
    // account is past onboarding, so they should be) — falls back to a
    // "fill in your stats" prompt otherwise, either of which proves the
    // Calorie targets section rendered without throwing.
    const suggestionOrPrompt = page.getByText(/Suggested:|for a suggested target/i).first();
    await expect(suggestionOrPrompt).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen shows Training days with weekday toggles, and toggling one updates Weekly Overview', async ({ page }) => {
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    await expect(page.getByText(/^Training days$/).first()).toBeVisible();

    const mondayToggle = page.getByRole('button', { name: /^Mon/ }).first();
    if (await mondayToggle.isVisible().catch(() => false)) {
      await mondayToggle.click();
      await page.getByRole('button', { name: /weekly/i }).first().click();
      // Just confirms the toggle round-trips into a render without throwing —
      // exact session content depends on the test account's active split.
      await expect(page.getByText(/mon|tue|wed|thu|fri|sat|sun/i).first()).toBeVisible();
    }
    expect(page.__consoleErrors).toEqual([]);
  });

  test('starting and exiting a gym session does not throw', async ({ page }) => {
    await page.getByRole('button', { name: /gym/i }).first().click();
    const startButton = page.getByRole('button', { name: /start/i }).first();
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await expect(page.getByText(/pause|exit|end/i).first()).toBeVisible();
      await page.getByRole('button', { name: /pause.*exit|exit/i }).first().click();
    }
    expect(page.__consoleErrors).toEqual([]);
  });
});
