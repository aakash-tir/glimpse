import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

async function launch(): Promise<ElectronApplication> {
  return await electron.launch({ args: ['.'], cwd: projectRoot });
}

async function getWindowBounds(
  app: ElectronApplication,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.getBounds();
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
    expect(beforeBounds.width).toBe(260);
    expect(beforeBounds.height).toBe(112);

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

test('title-bar weather-icon click collapses back to icon mode', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);

    await clickTitleBarButton(page, 'title-bar-weather-icon');
    // Collapse animation (~200 ms) + IPC + setBounds + mode-change round-trip.
    await page.waitForTimeout(500);

    const bounds = await getWindowBounds(app);
    expect(bounds.width).toBe(260);
    expect(bounds.height).toBe(112);
    await expect(page.getByTestId('icon-view')).toBeVisible();
  } finally {
    await app.close();
  }
});

test('minimize-to-icon button collapses to the right position', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    await expandToWindow(page);
    const expanded = await getWindowBounds(app);

    await clickTitleBarButton(page, 'title-bar-minimize');
    await page.waitForTimeout(500);

    const collapsed = await getWindowBounds(app);
    expect(collapsed.width).toBe(260);
    expect(collapsed.height).toBe(112);
    // The icon-mode window's icon glyph sits at offset (180, 16)
    // inside the 260x112 bounds. From the default-icon ↔ default-window
    // round-trip rule, expanding from default and collapsing without
    // moving must place the icon back at the default top-right.
    const bounds = collapsed;
    const iconCenterX = bounds.x + 180 + 32;
    const iconCenterY = bounds.y + 16 + 32;
    const expandedCenterX = expanded.x + expanded.width / 2;
    const expandedCenterY = expanded.y + expanded.height / 2;
    // Centers should align (within a couple of pixels for rounding).
    expect(Math.abs(iconCenterX - expandedCenterX)).toBeLessThanOrEqual(2);
    expect(Math.abs(iconCenterY - expandedCenterY)).toBeLessThanOrEqual(2);
  } finally {
    await app.close();
  }
});

test('relocate button resets the icon to the default top-right position', async () => {
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

    // Snapshot the relocate target (default top-right of the primary
    // display) before expanding.
    const expectedDefault = await app.evaluate(async ({ screen }) => {
      const work = screen.getPrimaryDisplay().workArea;
      // ICON_PADDING = 16, ICON_SIZE = 64.
      return { x: work.x + work.width - 64 - 16, y: work.y + 16 };
    });

    // Expand and click relocate.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);
    await clickTitleBarButton(page, 'title-bar-relocate');
    await page.waitForTimeout(500);

    const bounds = await getWindowBounds(app);
    // Icon-mode window: icon at offset (180, 16) inside 260x112.
    const iconScreenX = bounds.x + 180;
    const iconScreenY = bounds.y + 16;
    expect(iconScreenX).toBe(expectedDefault.x);
    expect(iconScreenY).toBe(expectedDefault.y);
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
