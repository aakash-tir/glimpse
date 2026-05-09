import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

async function launch(): Promise<ElectronApplication> {
  return await electron.launch({ args: ['.'], cwd: projectRoot });
}

// Some tests in this file save iconPosition / windowBounds to
// %APPDATA%\Glimpse\settings.json, which leaks state into later tests
// since Electron always reads the same path. Tests that need a clean
// slate call this before launching.
//
// We don't fully delete the file: a fresh-defaults profile would
// trigger the M7 first-launch location prompt, whose overlay sits
// over the slide deck and blocks panel interactions like drag /
// resize. Pre-setting locationPermissionAsked = true skips the
// prompt without changing any of the icon / window-mode behaviours
// these tests are actually exercising.
function resetSettings(): void {
  const appData = process.env['APPDATA'];
  if (!appData) return;
  const path = join(appData, 'Glimpse', 'settings.json');
  rmSync(path, { force: true });
  mkdirSync(join(appData, 'Glimpse'), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ locationPermissionAsked: true }),
    'utf-8',
  );
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

// Move the window into the middle of the screen so resize tests have
// room to grow in every direction. The default expand position is
// top-right, where the bottom-right resize is capped by the screen
// edge — useless for testing growth.
//
// Drag math: the renderer computes new-top-left = cursor + offset,
// where offset = startPos - startCursor (captured at mousedown). To
// shift the window's top-left by a delta D, the cursor must move by
// the same D. We pick start/end cursor coords so the cursor delta
// matches the desired window-top-left delta from default (~1740, 0)
// to the middle (~640, 400): (-1100, +400).
async function dragWindowToMiddle(page: Page): Promise<void> {
  const panel = page.getByTestId('window-view');
  await panel.dispatchEvent('click');
  await panel.dispatchEvent('click');
  await page.waitForTimeout(50);
  await expect(panel).toHaveAttribute('data-drag-mode', 'on');
  await panel.dispatchEvent('mousedown', { screenX: 1500, screenY: 100 });
  await page.evaluate(() => {
    window.dispatchEvent(
      new MouseEvent('mousemove', { screenX: 400, screenY: 500 }),
    );
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      new MouseEvent('mouseup', { screenX: 400, screenY: 500 }),
    );
  });
  await page.waitForTimeout(200);
  // Exit drag mode.
  await panel.dispatchEvent('click');
  await panel.dispatchEvent('click');
  await page.waitForTimeout(50);
  await expect(panel).toHaveAttribute('data-drag-mode', 'off');
}

test('single-click on icon expands to window mode at expected bounds with anchor data', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const icon = page.getByTestId('icon-view');
    await expect(icon).toBeVisible();

    const beforeBounds = await getWindowBounds(app);
    // Icon-mode bounds: 96 x 96 (Electron / Windows DWM may round-
    // trip the constructor's size by a few px on first paint).
    expect(beforeBounds.width).toBeGreaterThanOrEqual(94);
    expect(beforeBounds.width).toBeLessThanOrEqual(100);
    expect(beforeBounds.height).toBeGreaterThanOrEqual(94);
    expect(beforeBounds.height).toBeLessThanOrEqual(100);

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
    const preExpandIconScreenX = preExpand.x + 16;
    const preExpandIconScreenY = preExpand.y + 16;

    await expandToWindow(page);

    await clickTitleBarButton(page, 'title-bar-weather-icon');
    // Collapse animation (~200 ms) + IPC + setBounds + mode-change round-trip.
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    expect(collapsed.width).toBe(96);
    expect(collapsed.height).toBe(96);
    await expect(page.getByTestId('icon-view')).toBeVisible();

    // Icon glyph at offset (16, 16) inside 96×96 icon-mode bounds.
    const iconScreenX = collapsed.x + 16;
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
    // Icon-mode window: icon at offset (16, 16) inside 96×96.
    const iconScreenX = bounds.x + 16;
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
    expect(bounds.height).toBeGreaterThan(96);
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

test('window resize cannot grow off-screen (display-aware max-size cap)', async () => {
  // sub-feature 7 issue 1: dragging the bottom-right resize handle
  // far past the display edge used to grow the window past the
  // screen boundary because squareResize only capped against the
  // primary's overall maxWindowSize, not against the position of
  // the diagonal-fixed corner. maxSizeForResize fixes this.
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const display = await app.evaluate(
      async ({ screen }) => screen.getPrimaryDisplay().workArea,
    );

    // Mouse-down on bottom-right handle (top-left stays fixed at
    // current bounds), then drag wildly past the screen via real
    // mouse events (page.mouse). dispatchEvent on the handle was
    // unreliable for the resize React handler — page.mouse goes
    // through the OS event path and reaches the renderer the same
    // way a user's mouse would.
    const handle = page.getByTestId('resize-handle-bottom-right');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 5000, startY + 5000);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await getWindowBounds(app);
    expect(after.x + after.width).toBeLessThanOrEqual(
      display.x + display.width + 2,
    );
    expect(after.y + after.height).toBeLessThanOrEqual(
      display.y + display.height + 2,
    );
    // And it must still be a square.
    expect(Math.abs(after.width - after.height)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('minimize after resize lands icon at the resized window center', async () => {
  // sub-feature 7 issue 2: previously, pendingIconPosition (frozen
  // at expand time) didn't follow resizes, so collapse put the icon
  // at the original expand-time spot — far from where the resized
  // window visually appeared. Now collapseTargetFromWindow uses the
  // window's CURRENT center.
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    // Move to the middle so the bottom-right resize has room to grow.
    await dragWindowToMiddle(page);

    // Resize from bottom-right (top-left stays fixed). Use
    // page.mouse for reliable event delivery to the React handler.
    const handle = page.getByTestId('resize-handle-bottom-right');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 200);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const resized = await getWindowBounds(app);
    const expectedCenterX = resized.x + resized.width / 2;
    const expectedCenterY = resized.y + resized.height / 2;

    // Collapse via weather-icon (in-place collapse path).
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    // Icon glyph at offset (16, 16) inside 96×96 icon-mode bounds.
    const iconCenterX = collapsed.x + 16 + 32;
    const iconCenterY = collapsed.y + 16 + 32;
    // ±2 px DWM tolerance.
    expect(Math.abs(iconCenterX - expectedCenterX)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconCenterY - expectedCenterY)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('resize size persists across minimize → re-expand within session', async () => {
  // sub-feature 7 issue 3 (option b from the writeup): after a
  // resize, the next expand reuses that size at the icon's location
  // even with trackWindowPosition off. Disk persistence still
  // requires the toggle.
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const defaultExpanded = await getWindowBounds(app);
    const defaultSize = defaultExpanded.width;
    // Move to the middle so the bottom-right resize has room to grow.
    await dragWindowToMiddle(page);
    const afterDrag = await getWindowBounds(app);
    // Sanity: drag actually moved the window away from the default
    // top-right (otherwise the resize will be capped to current size).
    expect(afterDrag.x).toBeLessThan(defaultExpanded.x - 100);

    // Now resize from bottom-right — there's plenty of room to grow.
    const handle = page.getByTestId('resize-handle-bottom-right');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 200);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const resized = await getWindowBounds(app);
    const resizedSize = resized.width;
    // Sanity: the resize actually changed the size.
    expect(resizedSize).toBeGreaterThan(defaultSize + 50);

    // Collapse via weather-icon.
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    // Re-expand by clicking the icon.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);

    const reExpanded = await getWindowBounds(app);
    // ±2 px DWM tolerance — the new expand should reuse the resized
    // size, NOT fall back to default.
    expect(Math.abs(reExpanded.width - resizedSize)).toBeLessThanOrEqual(2);
    expect(Math.abs(reExpanded.height - resizedSize)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('B1: in-place collapse with no drag/resize returns icon to default exactly', async () => {
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();

    const expectedDefault = await app.evaluate(async ({ screen }) => {
      const work = screen.getPrimaryDisplay().workArea;
      return { x: work.x + work.width - 64 - 16, y: work.y + 16 };
    });

    await expandToWindow(page);
    // No drag, no resize. Click weather icon (in-place collapse).
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    const iconScreenX = collapsed.x + 16;
    const iconScreenY = collapsed.y + 16;
    expect(Math.abs(iconScreenX - expectedDefault.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconScreenY - expectedDefault.y)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('B2: resize only (no drag) returns icon to expand-time position, not window center', async () => {
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const expectedDefault = await app.evaluate(async ({ screen }) => {
      const work = screen.getPrimaryDisplay().workArea;
      return { x: work.x + work.width - 64 - 16, y: work.y + 16 };
    });

    await expandToWindow(page);

    // Resize from bottom-right WITHOUT dragging the window first.
    const handle = page.getByTestId('resize-handle-bottom-right');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Default-positioned window has limited room (it's at the
    // top-right edge); a small grow is enough to verify B2.
    await page.mouse.move(startX + 5, startY + 5);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const resized = await getWindowBounds(app);
    // Window center has shifted from default (since we resized). If
    // icon went to window center (wrong behavior), iconScreenX would
    // differ from expectedDefault by far more than 2 px.
    const wrongIconCenterX = resized.x + resized.width / 2;
    expect(Math.abs(wrongIconCenterX - 32 - expectedDefault.x)).toBeGreaterThan(
      2,
    );

    // Collapse via weather icon (B2 path).
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    const iconScreenX = collapsed.x + 16;
    const iconScreenY = collapsed.y + 16;
    // Icon should be back at expand-time default, NOT at the
    // resized window's center.
    expect(Math.abs(iconScreenX - expectedDefault.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconScreenY - expectedDefault.y)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('B3a: drag-to-corner snap puts icon at that corner with 16 px padding', async () => {
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const display = await app.evaluate(
      async ({ screen }) => screen.getPrimaryDisplay().workArea,
    );

    await expandToWindow(page);
    // Drag the window to within snap radius of the top-left corner.
    // dragWindowToMiddle's math doesn't apply here — use a fresh
    // gesture targeted at the top-left corner. The corner snap fires
    // within 40 px Euclidean of (0, 0).
    const panel = page.getByTestId('window-view');
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(panel).toHaveAttribute('data-drag-mode', 'on');
    // Default expanded window at ~(1731, 16). To park its top-left
    // near (0, 0) we need a cursor delta of (-1731, -16). Start at
    // a known cursor; end near the top-left.
    await panel.dispatchEvent('mousedown', { screenX: 1800, screenY: 100 });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 50, screenY: 50 }),
      );
    });
    await page.evaluate(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 50, screenY: 50 }),
      );
    });
    await page.waitForTimeout(200);
    // Exit drag mode.
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);

    // Collapse in-place.
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    const iconScreenX = collapsed.x + 16;
    const iconScreenY = collapsed.y + 16;
    // Icon should be at top-left corner with 16 px padding.
    expect(Math.abs(iconScreenX - (display.x + 16))).toBeLessThanOrEqual(2);
    expect(Math.abs(iconScreenY - (display.y + 16))).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('B3b: drag-to-edge snap puts icon at that edge midpoint', async () => {
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const display = await app.evaluate(
      async ({ screen }) => screen.getPrimaryDisplay().workArea,
    );

    await expandToWindow(page);
    // Two-step drag: dragWindowToMiddle puts the window in a known
    // central position, then a second drag with a smaller (and
    // therefore more reliable) cursor delta pushes it flush against
    // the LEFT edge to trip edge snap. Splitting in two keeps each
    // mousemove well within bounds the renderer can resolve via
    // dispatchEvent.
    await dragWindowToMiddle(page);
    const middlePos = await getWindowBounds(app);
    expect(middlePos.x).toBeGreaterThan(50); // away from edges.

    const panel = page.getByTestId('window-view');
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(panel).toHaveAttribute('data-drag-mode', 'on');
    // To shift top-left by (-(middlePos.x - 5), 0), the cursor must
    // shift by the same amount.
    const startCursor = { x: 700, y: 500 };
    const endCursor = { x: 700 - (middlePos.x - 5), y: 500 };
    await panel.dispatchEvent('mousedown', {
      screenX: startCursor.x,
      screenY: startCursor.y,
    });
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: x, screenY: y }),
      );
    }, endCursor);
    await page.evaluate(({ x, y }) => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: x, screenY: y }),
      );
    }, endCursor);
    await page.waitForTimeout(200);
    await panel.dispatchEvent('click');
    await panel.dispatchEvent('click');
    await page.waitForTimeout(50);
    await expect(panel).toHaveAttribute('data-drag-mode', 'off');

    // Edge snap parked the window flush at left, NOT at a corner.
    const dragged = await getWindowBounds(app);
    expect(Math.abs(dragged.x - display.x)).toBeLessThanOrEqual(2);
    expect(dragged.y).toBeGreaterThan(50);
    expect(dragged.y + dragged.height).toBeLessThan(
      display.y + display.height - 50,
    );

    // Collapse in-place. Icon should be at left-edge midpoint.
    await clickTitleBarButton(page, 'title-bar-weather-icon');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    const iconScreenX = collapsed.x + 16;
    const iconScreenY = collapsed.y + 16;
    expect(Math.abs(iconScreenX - (display.x + 16))).toBeLessThanOrEqual(2);
    const expectedY = display.y + Math.floor((display.height - 64) / 2);
    expect(Math.abs(iconScreenY - expectedY)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('A1: minimize after resize clears in-session size — next expand uses default size', async () => {
  resetSettings();
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const defaultExpanded = await getWindowBounds(app);
    const defaultSize = defaultExpanded.width;

    // Move to middle so the resize has room.
    await dragWindowToMiddle(page);

    // Resize bigger.
    const handle = page.getByTestId('resize-handle-bottom-right');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 200);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const resized = await getWindowBounds(app);
    expect(resized.width).toBeGreaterThan(defaultSize + 50);

    // Click MINIMIZE (not weather icon) — A1 path. This should clear
    // lastWindowSize so the next expand uses the default size.
    await clickTitleBarButton(page, 'title-bar-minimize');
    await page.waitForTimeout(500);

    // Re-expand.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);

    const reExpanded = await getWindowBounds(app);
    // Should be at DEFAULT size, NOT the resized size.
    expect(Math.abs(reExpanded.width - defaultSize)).toBeLessThanOrEqual(2);
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
    expect(bounds.height).toBeGreaterThan(96);
  } finally {
    await app.close();
  }
});
