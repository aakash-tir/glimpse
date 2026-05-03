import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

async function launch(): Promise<ElectronApplication> {
  return await electron.launch({ args: ['.'], cwd: projectRoot });
}

async function getIconWindowBounds(
  app: ElectronApplication,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.getBounds();
  });
}

// Two clicks dispatched back-to-back via the locator API land well
// under the 250 ms double-click threshold and avoid flakiness from
// real-time scheduling in CI.
async function doubleClickIcon(page: Page): Promise<void> {
  const icon = page.getByTestId('icon-root');
  await icon.dispatchEvent('click');
  await icon.dispatchEvent('click');
}

test('double-click enters drag mode and renders the glow', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const icon = page.getByTestId('icon-root');
    await expect(icon).toHaveAttribute('data-drag-mode', 'off');

    await doubleClickIcon(page);

    await expect(icon).toHaveAttribute('data-drag-mode', 'on');
    await expect(page.getByTestId('drag-mode-glow')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('clicking the transparent app area exits drag mode', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await doubleClickIcon(page);
    await expect(page.getByTestId('icon-root')).toHaveAttribute(
      'data-drag-mode',
      'on',
    );

    await page.getByTestId('icon-view').dispatchEvent('click');

    await expect(page.getByTestId('icon-root')).toHaveAttribute(
      'data-drag-mode',
      'off',
    );
  } finally {
    await app.close();
  }
});

test('single click on the icon while in drag mode does NOT exit drag mode', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await doubleClickIcon(page);
    await expect(page.getByTestId('icon-root')).toHaveAttribute(
      'data-drag-mode',
      'on',
    );

    // Single click on the icon, then wait past the threshold so the
    // pending single-click action would fire if it were going to.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(350);

    await expect(page.getByTestId('icon-root')).toHaveAttribute(
      'data-drag-mode',
      'on',
    );
  } finally {
    await app.close();
  }
});

test('mouse drag (mousedown → mousemove → mouseup) moves the icon window', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await doubleClickIcon(page);

    const before = await getIconWindowBounds(app);

    // Synthesize a deterministic -100×+50 drag using DOM events. The
    // icon starts at the default top-right; dragging LEFT keeps it on
    // screen (a +100 X drag would push past the right edge and trip
    // the clampIconForDrag guard, hiding the move under the clamp).
    const icon = page.getByTestId('icon-root');
    await icon.dispatchEvent('mousedown', { screenX: 1000, screenY: 500 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 900, screenY: 550 }),
      );
    });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 900, screenY: 550 }),
      );
    });

    // setBounds is async; let it settle.
    await page.waitForTimeout(200);

    const after = await getIconWindowBounds(app);
    expect(after.x - before.x).toBe(-100);
    expect(after.y - before.y).toBe(50);
  } finally {
    await app.close();
  }
});

test('a second app launch does not spawn a duplicate icon window', async () => {
  const app = await launch();
  try {
    // Make sure the first instance has fully booted and rendered its window.
    await app.firstWindow();
    const initialCount = await app.evaluate(async ({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().length;
    });
    expect(initialCount).toBe(1);

    // Spawn a second Electron process directly (Playwright's launch helper
    // can't be used here — the child quits as soon as the lock is denied
    // and that races with Playwright's own readiness handshake). The
    // process should exit on its own; we only need to confirm that no
    // duplicate icon window appeared and that the first instance is
    // unaffected.
    const electronBin = require('electron') as string;
    const child = spawn(electronBin, ['.'], { cwd: projectRoot });
    const exitCode = await new Promise<number | null>(
      (resolveExit, rejectExit) => {
        const timeout = setTimeout(() => {
          child.kill();
          rejectExit(new Error('second instance did not exit within 8 s'));
        }, 8000);
        child.once('exit', (code) => {
          clearTimeout(timeout);
          resolveExit(code);
        });
      },
    );
    expect(exitCode).toBe(0);

    const finalCount = await app.evaluate(async ({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().length;
    });
    expect(finalCount).toBe(1);
  } finally {
    await app.close();
  }
});
