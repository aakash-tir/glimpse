import { test, expect, _electron as electron } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

test('Electron app launches, shows a window with the right title, and exits cleanly', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: projectRoot,
  });

  const window = await app.firstWindow();
  await expect(window).toHaveTitle('Glimpse');

  await app.close();
});
