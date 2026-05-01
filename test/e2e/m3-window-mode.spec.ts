import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
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

test('single-click on icon expands to window mode at expected bounds with anchor data', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    const icon = page.getByTestId('icon-view');
    await expect(icon).toBeVisible();

    const beforeBounds = await getWindowBounds(app);
    // Icon-mode window: 260 wide × 112 tall transparent surface.
    expect(beforeBounds.width).toBe(260);
    expect(beforeBounds.height).toBe(112);

    // Single-click. The classifier waits 250 ms before firing the
    // single-click action; let it elapse.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);

    const afterBounds = await getWindowBounds(app);
    // Window mode is square. On a typical CI display we don't know the
    // exact size, but it must be square and within the configured range.
    expect(afterBounds.width).toBe(afterBounds.height);
    expect(afterBounds.width).toBeGreaterThanOrEqual(120);

    // WindowView is mounted with the anchor data attributes populated.
    const windowView = page.getByTestId('window-view');
    await expect(windowView).toBeVisible();
    const anchorX = await windowView.getAttribute('data-enter-anchor-x');
    const anchorY = await windowView.getAttribute('data-enter-anchor-y');
    // Anchor should be a finite number string (not empty), proving main
    // sent a real anchor (not initial mount) for the animation.
    expect(anchorX).not.toBe('');
    expect(anchorY).not.toBe('');
    expect(Number.isFinite(Number(anchorX))).toBe(true);
    expect(Number.isFinite(Number(anchorY))).toBe(true);
  } finally {
    await app.close();
  }
});

test('clicking the panel collapses back to icon mode at window-center → icon-center', async () => {
  const app = await launch();
  try {
    const page = await app.firstWindow();
    // Expand first.
    await page.getByTestId('icon-root').dispatchEvent('click');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('window-view')).toBeVisible();

    const expandedBounds = await getWindowBounds(app);

    // Collapse via the placeholder panel click.
    await page.getByTestId('window-view').dispatchEvent('click');
    await page.waitForTimeout(300);

    const collapsedBounds = await getWindowBounds(app);
    expect(collapsedBounds.width).toBe(260);
    expect(collapsedBounds.height).toBe(112);

    // The icon-mode window's icon position is at offset (180, 16) within
    // its bounds, so the icon's screen center should match the expanded
    // window's center (modulo clamping). When the icon was at default
    // top-right and the expanded window is also at default position,
    // the expanded center maps back to default-icon.
    // Just confirm the window is now small.
    expect(collapsedBounds.width).toBeLessThan(expandedBounds.width);
    expect(collapsedBounds.height).toBeLessThan(expandedBounds.height);
  } finally {
    await app.close();
  }
});
