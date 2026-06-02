import { test, expect } from '@playwright/test';
import { launchGlimpse } from './launch';

test('Electron app launches, shows a window with the right title, and exits cleanly', async () => {
  const app = await launchGlimpse();

  const window = await app.firstWindow();
  await expect(window).toHaveTitle('Glimpse');

  await app.close();
});
