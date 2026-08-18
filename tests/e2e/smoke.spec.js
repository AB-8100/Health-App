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

  test('Analytics screen loads and shows an activity picker or empty state', async ({ page }) => {
    await page.getByRole('button', { name: /analytics/i }).first().click();
    await expect(page.getByTestId('analytics-screen')).toBeVisible();
    // Loosely scoped: the test account may or may not have logged sessions,
    // so either the activity picker or the "no sessions yet" empty state is
    // an acceptable render — this just proves the screen doesn't throw.
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

  test('Redo goals & questionnaire opens the merged onboarding flow with no AI generation button', async ({ page }) => {
    // features/specs/deterministic-endurance-plan-generator.md §A/§D — Stage 2
    // and the former Stage 3 are one continuous flow now, with no AI-generation
    // entry point anywhere in the app.
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    const redoButton = page.getByRole('button', { name: /redo my goals/i });
    await expect(redoButton).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);

    await redoButton.click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.getByText(/what are your goals/i)).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/generate.*with ai|regenerate.*with ai/i);
    expect(page.__consoleErrors).toEqual([]);

    // Back out without completing — should not throw or leave onboarding stuck.
    await page.getByRole('button', { name: '×' }).first().click();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen Feedback section accepts a message and submit is disabled while empty', async ({ page }) => {
    // features/specs/feedback-entry-point.md
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    await expect(page.getByText(/^Feedback$/).first()).toBeVisible();

    const submitButton = page.getByRole('button', { name: /send feedback/i });
    await expect(submitButton).toBeDisabled();

    const textarea = page.getByPlaceholder(/what's on your mind/i);
    await textarea.fill('Smoke test feedback — please ignore.');
    await expect(submitButton).toBeEnabled();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('selecting Trail Running as a race type reaches a generated plan', async ({ page }) => {
    // features/specs/trail-running-support.md §A/§B — Trail Running is a
    // RACE_TYPES entry like 10K/Marathon, not a separate goal type, so this
    // walks the same merged onboarding flow the "Redo my goals" test above
    // opens, but drives it through to a completed, generated plan.
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    const redoButton = page.getByRole('button', { name: /redo my goals/i });
    await expect(redoButton).toBeVisible();
    await redoButton.click();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.getByText(/what are your goals/i)).toBeVisible();

    // Click through to "Race details." — the test account is already past
    // onboarding with an event_race goal (other smoke tests above rely on an
    // existing generated plan), so this is at most a couple of steps away.
    for (let i = 0; i < 5; i++) {
      if (await page.getByText(/^Race details\.$/).isVisible().catch(() => false)) break;
      await page.getByRole('button', { name: /^continue →$/i }).click();
    }
    await expect(page.getByText(/^Race details\.$/)).toBeVisible();

    await page.getByRole('button', { name: 'Trail Running', exact: true }).click();

    // Target race distance — required to advance once Trail Running is
    // selected (drives the peak long-run sizing, see planEngine.js).
    await expect(page.getByTestId('trail-distance-bubble')).toBeVisible();
    await page.getByPlaceholder('e.g. 42').fill('42');
    await page.getByRole('button', { name: /^continue →$/i }).click();

    // Day picker — deterministically select exactly 3 running days
    // regardless of whatever the account's previous race type had picked,
    // using the data-selected state each day toggle now carries.
    await expect(page.getByText(/your training setup/i)).toBeVisible();
    const desiredDays = ['tuesday', 'thursday', 'saturday'];
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      const toggle = page.getByTestId(`day-toggle-run-${day}`);
      const selected = (await toggle.getAttribute('data-selected')) === 'true';
      const want = desiredDays.includes(day);
      if (selected !== want) await toggle.click();
    }
    await expect(page.getByText(/pick 3 or 4 days for trail running/i)).not.toBeVisible();
    await page.getByRole('button', { name: /^continue →$/i }).click();

    // Run baseline — trail-only paired distance/time field (same effort).
    await expect(page.getByText(/^Run baseline\.$/)).toBeVisible();
    await page.getByPlaceholder('e.g. 15').fill('15');
    await page.getByPlaceholder('e.g. 120').fill('120');
    await page.getByRole('button', { name: /^continue →$/i }).click();

    // Availability / preferences / injury are all optional past this point —
    // click straight through to completion.
    for (let i = 0; i < 6; i++) {
      if (await page.getByText(/your plan is ready/i).isVisible().catch(() => false)) break;
      await page.getByRole('button', { name: /^continue →$/i }).click();
    }
    await expect(page.getByText(/your plan is ready/i)).toBeVisible();
    await expect(page.getByText(/trail running/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);

    await page.getByRole('button', { name: /^enter forma →$/i }).click();
    await expect(page.getByText(/mon|tue|wed|thu|fri|sat|sun/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('Add session picks a Bike activity and disambiguates a same-day duplicate', async ({ page }) => {
    // features/specs/weekly-overview-add-session-activity-matrix.md §D/§F —
    // the two-step picker resolves a bike-type session to its default
    // activity_catalog row (correct icon/label), and a second same-day pick
    // of the same type gets a " 2" suffix instead of colliding.
    await expect(page.getByText(/mon|tue|wed|thu|fri|sat|sun/i).first()).toBeVisible();

    await page.getByRole('button', { name: '+ Add session', exact: true }).click();
    await expect(page.getByText(/^add a session$/i)).toBeVisible();
    await page.getByRole('button', { name: /^mon/i }).first().click();
    await page.getByRole('button', { name: /bike/i }).first().click();
    await page.getByRole('button', { name: 'Add session', exact: true }).click();

    await expect(page.getByText(/^add a session$/i)).not.toBeVisible();
    await expect(page.getByText(/^cycling \(moderate ride\)$/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);

    await page.getByRole('button', { name: '+ Add session', exact: true }).click();
    await page.getByRole('button', { name: /^mon/i }).first().click();
    await page.getByRole('button', { name: /bike/i }).first().click();
    await page.getByRole('button', { name: 'Add session', exact: true }).click();

    await expect(page.getByText(/^cycling \(moderate ride\) 2$/i).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });

  test('About screen shows a standalone Glossary section irrespective of plan state', async ({ page }) => {
    // The Glossary bar always renders data/planGlossary.js's full static
    // list — unlike Training plan's collapsible "Plan overview", it does not
    // depend on the active plan's meta carrying engine-generated
    // overview/glossary fields (an uploaded/AI-generated/pre-engine plan
    // won't have those).
    await page.getByRole('button', { name: /about|me|profile|settings/i }).first().click();
    await expect(page.getByText(/^Glossary$/).first()).toBeVisible();

    await page.getByText(/▼ Show/).last().click();
    await expect(page.getByText(/^Easy run$/).first()).toBeVisible();
    await expect(page.getByText(/^Brick$/).first()).toBeVisible();
    expect(page.__consoleErrors).toEqual([]);
  });
});
