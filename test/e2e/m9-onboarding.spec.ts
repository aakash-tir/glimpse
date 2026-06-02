import { test, expect } from '@playwright/test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { launchGlimpse as launch } from './launch';

function settingsPath(): string | null {
  const appData = process.env['APPDATA'];
  return appData ? join(appData, 'Glimpse', 'settings.json') : null;
}

// Clean profile with onboarding NOT completed → the tutorial runs.
// locationPermissionAsked = true keeps the post-completion window free
// of the first-launch location prompt.
test.beforeEach(() => {
  const path = settingsPath();
  if (!path) return;
  rmSync(path, { force: true });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ locationPermissionAsked: true }),
    'utf-8',
  );
});

function onboardingCompleted(): boolean {
  const path = settingsPath();
  if (!path || !existsSync(path)) return false;
  const raw = JSON.parse(readFileSync(path, 'utf-8')) as {
    onboardingCompleted?: boolean;
  };
  return raw.onboardingCompleted === true;
}

test('shows the tutorial on a clean profile and completes via Next', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('coachmark')).toBeVisible();
    await expect(page.getByTestId('coachmark')).toHaveAttribute(
      'data-step-index',
      '0',
    );
    // 8 steps: 7 Next presses + a final "Done".
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('coachmark-next').click();
    }
    await page.waitForTimeout(500);
    expect(onboardingCompleted()).toBe(true);
    await expect(page.getByTestId('coachmark')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('advances via gestures on the mock elements', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('coachmark')).toHaveAttribute(
      'data-step-index',
      '0',
    );
    await page.getByTestId('mock-icon').click(); // welcome → slides
    await expect(page.getByTestId('coachmark')).toHaveAttribute(
      'data-step-index',
      '1',
    );
    await page.getByTestId('mock-arrow-right').click(); // slides → switch
    await expect(page.getByTestId('coachmark')).toHaveAttribute(
      'data-step-index',
      '2',
    );
  } finally {
    await app.close();
  }
});

test('skip exits cleanly and marks onboarding completed', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expect(page.getByTestId('coachmark')).toBeVisible();
    await page.getByTestId('coachmark-skip').click();
    await page.waitForTimeout(500);
    expect(onboardingCompleted()).toBe(true);
    await expect(page.getByTestId('coachmark')).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test('an interrupted run resumes from step 1 on the next launch', async () => {
  const app = await launch();
  const page = await app.firstWindow();
  await page.getByTestId('coachmark-next').click(); // → step 1
  await expect(page.getByTestId('coachmark')).toHaveAttribute(
    'data-step-index',
    '1',
  );
  // Close mid-tutorial — must NOT mark completion.
  await app.close();
  expect(onboardingCompleted()).toBe(false);

  const app2 = await launch();
  try {
    const page2 = await app2.firstWindow();
    await expect(page2.getByTestId('coachmark')).toHaveAttribute(
      'data-step-index',
      '0',
    );
  } finally {
    await app2.close();
  }
});
