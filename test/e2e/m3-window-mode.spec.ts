import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

async function launch(): Promise<ElectronApplication> {
  return await electron.launch({ args: ['.'], cwd: projectRoot });
}

async function spawnSecondInstance(): Promise<void> {
  const electronBin = require('electron') as string;
  const child = spawn(electronBin, ['.'], { cwd: projectRoot });
  await new Promise<void>((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      child.kill();
      rejectExit(new Error('second instance did not exit within 8 s'));
    }, 8000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

async function getWindowBounds(
  app: ElectronApplication,
): Promise<{ x: number; y: number; width: number; height: number }> {
  // Use content bounds — on Windows 11, frameless windows have an
  // invisible OS-added resize border (a few pixels) that getBounds()
  // reports but the actual painted content area excludes. Content
  // bounds match what the renderer thinks the window is.
  return await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.getContentBounds();
  });
}

async function expandToWindow(page: Page): Promise<void> {
  await page.getByTestId('icon-root').dispatchEvent('click');
  await page.waitForTimeout(400);
  await expect(page.getByTestId('window-view')).toBeVisible();
}

async function clickTitleBarButton(page: Page, testid: string): Promise<void> {
  // Title bar is invisible until the top edge is hovered. Hover the
  // container first so its buttons gain pointer-events.
  await page.getByTestId('title-bar-container').hover();
  // Wait for fade-in (~150 ms) + a small buffer.
  await page.waitForTimeout(220);
  await page.getByTestId(testid).click();
}

test('single-click on icon expands to window mode at expected bounds with anchor data', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const icon = page.getByTestId('icon-view');
    await expect(icon).toBeVisible();

    const beforeBounds = await getWindowBounds(app);
    // Icon-mode bounds: roughly 260 x 112 (Electron / Windows DWM may
    // round-trip the constructor's size by a few px on first paint).
    expect(beforeBounds.width).toBeGreaterThanOrEqual(255);
    expect(beforeBounds.width).toBeLessThanOrEqual(270);
    expect(beforeBounds.height).toBeGreaterThanOrEqual(108);
    expect(beforeBounds.height).toBeLessThanOrEqual(120);

    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);

    const afterBounds = await getWindowBounds(app);
    expect(afterBounds.width).toBe(afterBounds.height);
    expect(afterBounds.width).toBeGreaterThanOrEqual(120);

    const windowView = page.getByTestId('window-view');
    await expect(windowView).toBeVisible();
    const anchorX = await windowView.getAttribute('data-enter-anchor-x');
    const anchorY = await windowView.getAttribute('data-enter-anchor-y');
    expect(anchorX).not.toBe('');
    expect(anchorY).not.toBe('');
    expect(Number.isFinite(Number(anchorX))).toBe(true);
    expect(Number.isFinite(Number(anchorY))).toBe(true);
  } finally {
    await app.close();
  }
});

test('title-bar weather-icon click collapses to icon at the window position', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();

    // Snapshot the icon's pre-expand bounds — that's where the in-place
    // collapse should return it. Comparing against the expanded
    // window's center would be wrong: the window may get nudged inward
    // by the on-screen clamp at expand time, and the new collapse model
    // (pendingIconPosition) returns the icon to its expand-time spot,
    // not to the clamped window's center.
    const preExpand = await getWindowBounds(app);
    const preExpandIconScreenX = preExpand.x + 180;
    const preExpandIconScreenY = preExpand.y + 16;

    await expandToWindow(page);

    await clickTitleBarButton(page, 'title-bar-weather-icon');
    // Collapse animation (~200 ms) + IPC + setBounds + mode-change round-trip.
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    expect(collapsed.width).toBe(260);
    expect(collapsed.height).toBe(112);
    await expect(page.getByTestId('icon-view')).toBeVisible();

    // Icon glyph at offset (180, 16) inside 260x112 icon-mode bounds.
    const iconScreenX = collapsed.x + 180;
    const iconScreenY = collapsed.y + 16;
    expect(Math.abs(iconScreenX - preExpandIconScreenX)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconScreenY - preExpandIconScreenY)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('minimize-to-icon button resets the icon to the default top-right position', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();

    // Move the icon away from default so we can verify the reset is
    // actually doing something. Double-click → drag mode → drag → release.
    const icon = page.getByTestId('icon-root');
    await icon.dispatchEvent('click');
    await icon.dispatchEvent('click');
    await page.waitForTimeout(50);
    await icon.dispatchEvent('mousedown', { screenX: 1000, screenY: 500 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 700, screenY: 500 }),
      );
    });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 700, screenY: 500 }),
      );
    });
    await page.waitForTimeout(200);
    // Click outside to exit drag mode.
    await page.getByTestId('icon-view').dispatchEvent('click');

    // Snapshot the reset target (default top-right of the primary
    // display) before expanding.
    const expectedDefault = await app.evaluate(async ({ screen }) => {
      const work = screen.getPrimaryDisplay().workArea;
      // ICON_PADDING = 16, ICON_SIZE = 64.
      return { x: work.x + work.width - 64 - 16, y: work.y + 16 };
    });

    // Expand and click minimize. The minimize button now does what the
    // (removed) relocate button used to: collapse + reset icon to the
    // default top-right corner. The weather-icon button is the only
    // in-place collapse path now.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);
    await clickTitleBarButton(page, 'title-bar-minimize');
    await page.waitForTimeout(500);

    const bounds = await getWindowBounds(app);
    // Icon-mode window: icon at offset (180, 16) inside 260x112.
    const iconScreenX = bounds.x + 180;
    const iconScreenY = bounds.y + 16;
    // Allow a couple of pixels of slack — Windows DPI / DWM can
    // round-trip setBounds → getContentBounds with a small offset
    // that doesn't reflect an actual position difference.
    expect(Math.abs(iconScreenX - expectedDefault.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconScreenY - expectedDefault.y)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('× button quits the app (process exits)', async () => {
  const app = await launch();
  const proc = app.process();
  let exited = false;
  proc.once('exit', () => {
    exited = true;
  });
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    await clickTitleBarButton(page, 'title-bar-close');

    // Poll for exit; up to 5 s.
    const start = Date.now();
    while (!exited && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(exited).toBe(true);
  } finally {
    if (!exited) {
      await app.close();
    }
  }
});

test('outside-click does NOT close the window', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);

    // Simulate the OS taking focus away. The renderer should not collapse.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(300);

    await expect(page.getByTestId('window-view')).toBeVisible();
    const bounds = await getWindowBounds(app);
    expect(bounds.width).toBe(bounds.height);
    expect(bounds.height).toBeGreaterThan(112);
  } finally {
    await app.close();
  }
});

test('single-instance lock — 2nd launch from icon mode auto-expands', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    // Confirm we start in icon mode.
    await expect(page.getByTestId('icon-view')).toBeVisible();

    await spawnSecondInstance();
    // Mode change + setBounds + renderer swap.
    await page.waitForTimeout(500);

    await expect(page.getByTestId('window-view')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('single-instance lock — 2nd launch with window already open focuses', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const before = await getWindowBounds(app);

    await spawnSecondInstance();
    await page.waitForTimeout(300);

    // Still in window mode at the same bounds — focus is a no-op for the
    // user-visible state aside from window stacking.
    await expect(page.getByTestId('window-view')).toBeVisible();
    const after = await getWindowBounds(app);
    expect(after).toEqual(before);
  } finally {
    await app.close();
  }
});

test('single-instance lock — 2nd launch in icon-drag mode exits drag and expands', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const icon = page.getByTestId('icon-root');

    // Enter icon-drag mode (double-click).
    await icon.dispatchEvent('click');
    await icon.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(icon).toHaveAttribute('data-drag-mode', 'on');

    await spawnSecondInstance();
    await page.waitForTimeout(500);

    // Now in window mode; the icon-mode drag-mode state is gone with
    // the unmounted IconView.
    await expect(page.getByTestId('window-view')).toBeVisible();
    expect(await page.getByTestId('icon-view').count()).toBe(0);
  } finally {
    await app.close();
  }
});

test('window-mode drag does not change the window size (regression)', async () => {
  // Issue 4 from manual-tests-review: dragging the window in
  // window-mode used to grow the window by a few px per mousemove
  // because the dragMove handler re-read getBounds() (frame-inclusive
  // on Windows DWM) and fed it back to setBounds() (which interprets
  // the size differently). Snapshotting size at drag:start removes
  // the round-trip; this test asserts the size stays put across many
  // moves.
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const before = await getWindowBounds(app);

    // Enter window-drag mode (double-click panel body).
    const panel = page.getByTestId('window-view');
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(panel).toHaveAttribute('data-drag-mode', 'on');

    // Synthesize a long sequence of mousemoves so any per-tick drift
    // accumulates into something measurable. mousedown anchors the
    // drag at the cursor's start position; each mousemove streams
    // drag:move IPCs that previously called getBounds()+setBounds().
    await panel.dispatchEvent('mousedown', { screenX: 600, screenY: 400 });
    for (let i = 0; i < 20; i++) {
      await page.evaluate((step) => {
        window.dispatchEvent(
          new MouseEvent('mousemove', {
            screenX: 600 + step * 5,
            screenY: 400 + step * 3,
          }),
        );
      }, i);
    }
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 700, screenY: 460 }),
      );
    });
    await page.waitForTimeout(200);

    const after = await getWindowBounds(app);
    // Width and height MUST be unchanged across the drag. ±2 px
    // tolerates Windows DWM rounding on a single setBounds, which is
    // already covered by the bounds-rounding workaround in commit
    // 737f299; anything beyond that is the per-tick drift bug.
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
    // The window did move (sanity check that the drag actually fired).
    expect(after.x).not.toBe(before.x);
  } finally {
    await app.close();
  }
});

test('window-mode drag clamps to display edges (cannot drag off-screen)', async () => {
  // Per the manual-tests-review follow-up: dragging the window past
  // the right or bottom edge should leave it hugging that edge, not
  // partially or fully off-screen. clampWindowForDrag in main is
  // responsible; the unit tests cover its math, this E2E confirms
  // the IPC wiring + setBounds path actually applies the clamp.
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const before = await getWindowBounds(app);
    const display = await app.evaluate(
      async ({ screen }) => screen.getPrimaryDisplay().workArea,
    );

    // Enter window-drag mode.
    const panel = page.getByTestId('window-view');
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(panel).toHaveAttribute('data-drag-mode', 'on');

    // Try to drag well past the right + bottom edges.
    await panel.dispatchEvent('mousedown', { screenX: 400, screenY: 300 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 9999, screenY: 9999 }),
      );
    });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 9999, screenY: 9999 }),
      );
    });
    await page.waitForTimeout(200);

    const after = await getWindowBounds(app);
    // Window's right edge ≤ display's right edge (within ±2 px DWM
    // rounding); same for bottom. Width/height unchanged.
    expect(after.x + after.width).toBeLessThanOrEqual(
      display.x + display.width + 2,
    );
    expect(after.y + after.height).toBeLessThanOrEqual(
      display.y + display.height + 2,
    );
    expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('Esc does NOT close the window', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(page.getByTestId('window-view')).toBeVisible();
    const bounds = await getWindowBounds(app);
    expect(bounds.width).toBe(bounds.height);
    expect(bounds.height).toBeGreaterThan(112);
  } finally {
    await app.close();
  }
});
