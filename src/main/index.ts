import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  clampIconForDrag,
  clampIconToDisplay,
  defaultIconPosition,
  ICON_OFFSET_X,
  ICON_OFFSET_Y,
  ICON_SIZE,
  resolveIconPosition,
  windowPositionForIcon,
  WINDOW_HEIGHT as ICON_WINDOW_HEIGHT,
  WINDOW_WIDTH as ICON_WINDOW_WIDTH,
  type DisplayBounds,
} from '../shared/icon-position';
import { computeIconPosFromCursor, type ScreenPoint } from '../shared/drag';
import { snapToCorner } from '../shared/snap';
import {
  clampWindowForDrag,
  maxWindowSize,
  resolveWindowBoundsForExpand,
  snapWindowToCorner,
  squareResize,
  WINDOW_MIN_SIZE_PX,
  type ResizeCorner,
} from '../shared/window-position';
import type { IconPosition, WindowBounds } from '../shared/settings-store';
import type { Mode, ModeChange } from '../shared/mode';
import { loadSettings, saveSettings } from './settings';

const __dirname = dirname(fileURLToPath(import.meta.url));

let iconWindow: BrowserWindow | null = null;
let mode: Mode = 'icon';

function primaryBounds(): DisplayBounds {
  return screen.getPrimaryDisplay().workArea;
}

function allDisplayBounds(): DisplayBounds[] {
  return screen.getAllDisplays().map((d) => d.workArea);
}

function createIconWindow(): void {
  const settings = loadSettings();
  const iconPos = resolveIconPosition(
    settings.iconPosition,
    primaryBounds(),
    allDisplayBounds(),
  );
  const winPos = windowPositionForIcon(iconPos);

  iconWindow = new BrowserWindow({
    width: ICON_WINDOW_WIDTH,
    height: ICON_WINDOW_HEIGHT,
    x: winPos.x,
    y: winPos.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  iconWindow.on('ready-to-show', () => {
    iconWindow?.show();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void iconWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void iconWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function snapBackIfOffScreen(): void {
  if (!iconWindow) return;
  // Display changes only re-anchor the icon; if the user is currently in
  // window mode we leave the panel where it is (the user is actively
  // looking at it). The next collapse will re-clamp pendingIconPosition
  // via clampIconToDisplay in nextIconPositionForCollapse.
  if (mode !== 'icon') return;

  const settings = loadSettings();
  const resolvedIcon = resolveIconPosition(
    settings.iconPosition,
    primaryBounds(),
    allDisplayBounds(),
  );
  const winPos = windowPositionForIcon(resolvedIcon);
  iconWindow.setBounds({
    x: winPos.x,
    y: winPos.y,
    width: ICON_WINDOW_WIDTH,
    height: ICON_WINDOW_HEIGHT,
  });

  // If we had to fall back to the default position, clear the saved
  // iconPosition so future launches use the default until the user moves
  // the icon again.
  if (settings.iconPosition && resolvedIcon !== settings.iconPosition) {
    const def = defaultIconPosition(primaryBounds());
    if (resolvedIcon.x === def.x && resolvedIcon.y === def.y) {
      saveSettings({ iconPosition: null });
    }
  }
}

// Window-subject drags carry the window's size captured at drag:start
// so drag:move can reapply it byte-for-byte without re-reading
// getBounds() each tick. On Windows 11 frameless windows, the
// getBounds() / setBounds() round-trip drifts by a few pixels per
// call (the same DWM frame quirk worked around in commit 737f299).
// Re-reading and re-writing every mousemove accumulated that drift
// into a visible expansion over the course of a long drag — Issue 4
// in the manual-tests-review.md write-up. Snapshotting once removes
// the round-trip entirely.
type DragSession =
  | {
      subject: 'icon';
      startCursor: ScreenPoint;
      startPos: { x: number; y: number };
    }
  | {
      subject: 'window';
      startCursor: ScreenPoint;
      startPos: { x: number; y: number };
      startSize: { width: number; height: number };
      // Where the window's top-left actually landed after the most
      // recent drag tick. clampWindowForDrag uses this to decide which
      // display the window is currently anchored to when the cursor
      // crosses a multi-monitor seam — so we don't need to call
      // getBounds() each tick (which would re-introduce the DWM frame
      // drift that fix 4 just removed).
      lastAppliedPos: { x: number; y: number };
    };

let dragSession: DragSession | null = null;

type ResizeSession = {
  corner: ResizeCorner;
  startCursor: ScreenPoint;
  origin: WindowBounds;
};

let resizeSession: ResizeSession | null = null;

// Where the icon will land on collapse. Captured at expand time and
// shifted by the same delta whenever the user drags the window. Resize
// does NOT move it (per user spec: dragging the window moves the icon
// with it; resizing alone leaves the icon's resting position alone).
// Cleared after collapse.
let pendingIconPosition: IconPosition | null = null;
// The window's top-left at the most recent expand / drag-end / resize-end.
// Diffing against this on the next drag/resize gives us the move delta
// without depending on what the renderer thinks the bounds are.
let windowOriginAtExpand: { x: number; y: number } | null = null;

function currentIconPosition(): IconPosition {
  if (!iconWindow) {
    return defaultIconPosition(primaryBounds());
  }
  const bounds = iconWindow.getBounds();
  return {
    x: bounds.x + ICON_OFFSET_X,
    y: bounds.y + ICON_OFFSET_Y,
  };
}

function applyIconPosition(pos: IconPosition): void {
  if (!iconWindow) return;
  // Callers are responsible for clamping (drag handlers use
  // clampIconForDrag for cross-display behavior; collapse paths clamp
  // via clampIconToDisplay against the primary). This keeps the helper
  // pure-positional so multi-monitor placements aren't yanked back to
  // the primary display.
  const win = windowPositionForIcon(pos);
  iconWindow.setBounds({
    x: win.x,
    y: win.y,
    width: ICON_WINDOW_WIDTH,
    height: ICON_WINDOW_HEIGHT,
  });
}

function applyWindowBounds(bounds: WindowBounds): void {
  if (!iconWindow) return;
  iconWindow.setBounds(bounds);
}

function modeChangePayload(
  newMode: Mode,
  newBounds: WindowBounds,
  anchorScreen: { x: number; y: number } | null,
): ModeChange {
  const anchor = anchorScreen
    ? { x: anchorScreen.x - newBounds.x, y: anchorScreen.y - newBounds.y }
    : null;
  return {
    mode: newMode,
    anchor,
    bounds: { width: newBounds.width, height: newBounds.height },
  };
}

function expandToWindow(): ModeChange {
  if (!iconWindow) {
    return {
      mode: 'icon',
      anchor: null,
      bounds: { width: ICON_WINDOW_WIDTH, height: ICON_WINDOW_HEIGHT },
    };
  }
  if (mode === 'window') {
    const b = iconWindow.getBounds();
    return modeChangePayload('window', b, null);
  }
  const iconPos = currentIconPosition();
  const settings = loadSettings();
  const bounds = resolveWindowBoundsForExpand({
    iconPos,
    primary: primaryBounds(),
    trackWindowPosition: settings.trackWindowPosition,
    savedBounds: settings.windowBounds,
    allDisplays: allDisplayBounds(),
  });
  applyWindowBounds(bounds);
  // Capture where the icon will return to on collapse. Window-mode
  // drags shift this 1:1; resize leaves it alone. See comments at the
  // declarations of pendingIconPosition / windowOriginAtExpand.
  pendingIconPosition = iconPos;
  windowOriginAtExpand = { x: bounds.x, y: bounds.y };
  mode = 'window';
  // Anchor: where the icon's center was on screen.
  const anchorScreen = {
    x: iconPos.x + ICON_SIZE / 2,
    y: iconPos.y + ICON_SIZE / 2,
  };
  const payload = modeChangePayload('window', bounds, anchorScreen);
  iconWindow.webContents.send('mode:changed', payload);
  return payload;
}

type CollapseOpts = { resetToDefault?: boolean };

// Returns where the icon should land when the panel collapses.
//   - Relocate (resetToDefault): always default top-right.
//   - Otherwise: the pendingIconPosition captured at expand and
//     shifted by any window drags since. Clamped to the primary
//     display so a stale value (e.g. after a monitor disconnect)
//     can't strand the icon off-screen.
//   - Fallback: pre-M3 behavior (icon at the icon's current location)
//     in the unlikely event we're collapsing without a pending value.
function nextIconPositionForCollapse(opts: CollapseOpts): IconPosition {
  if (!iconWindow) return defaultIconPosition(primaryBounds());
  if (opts.resetToDefault) return defaultIconPosition(primaryBounds());
  if (pendingIconPosition) {
    return clampIconToDisplay(pendingIconPosition, primaryBounds());
  }
  return currentIconPosition();
}

function previewCollapseAnchor(opts: CollapseOpts): { x: number; y: number } {
  if (!iconWindow || mode !== 'window') return { x: 0, y: 0 };
  const winBounds = iconWindow.getBounds();
  const iconPos = nextIconPositionForCollapse(opts);
  // Local to current (still-window-mode) bounds: the icon's center as
  // it'll appear after the resize, expressed in the renderer's current
  // coordinate space. The collapse animation's transform-origin uses
  // this so the panel shrinks toward where the icon will end up.
  return {
    x: iconPos.x + ICON_SIZE / 2 - winBounds.x,
    y: iconPos.y + ICON_SIZE / 2 - winBounds.y,
  };
}

function collapseToIcon(opts: CollapseOpts = {}): ModeChange {
  if (!iconWindow) {
    return {
      mode: 'icon',
      anchor: null,
      bounds: { width: ICON_WINDOW_WIDTH, height: ICON_WINDOW_HEIGHT },
    };
  }
  if (mode === 'icon') {
    const b = iconWindow.getBounds();
    return modeChangePayload('icon', b, null);
  }
  const winBounds = iconWindow.getBounds();
  // If trackWindowPosition is on, snapshot the window's current bounds
  // before collapsing so the next expand restores exactly what the
  // user was looking at (in case they hadn't moved/resized since the
  // toggle was switched on).
  const collapseSettings = loadSettings();
  if (collapseSettings.trackWindowPosition) {
    saveSettings({ windowBounds: winBounds });
  }
  const iconPos = nextIconPositionForCollapse(opts);
  applyIconPosition(iconPos);
  // Reset → clear the saved iconPosition so a future launch uses the
  // current default (which may shift if the display layout changes).
  // Otherwise persist the icon's new resting place.
  if (opts.resetToDefault) {
    saveSettings({ iconPosition: null });
  } else {
    saveSettings({ iconPosition: iconPos });
  }
  pendingIconPosition = null;
  windowOriginAtExpand = null;
  mode = 'icon';
  // After resize, the new bounds describe the icon-mode window.
  const newBounds: WindowBounds = {
    x: iconPos.x - ICON_OFFSET_X,
    y: iconPos.y - ICON_OFFSET_Y,
    width: ICON_WINDOW_WIDTH,
    height: ICON_WINDOW_HEIGHT,
  };
  // Anchor for the icon-view entry: the center of the panel that just
  // collapsed, in the new (icon-mode) window's coordinate space. The
  // icon-view doesn't currently animate-in, so this is informational
  // for now — the renderer simply ignores the anchor when mode === 'icon'.
  const anchorScreen = {
    x: winBounds.x + winBounds.width / 2,
    y: winBounds.y + winBounds.height / 2,
  };
  const payload = modeChangePayload('icon', newBounds, anchorScreen);
  iconWindow.webContents.send('mode:changed', payload);
  return payload;
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_evt, patch) => saveSettings(patch));

  ipcMain.handle('mode:get', () => mode);
  ipcMain.handle('mode:expand', () => expandToWindow());
  ipcMain.handle('mode:collapse', (_evt, opts?: CollapseOpts) =>
    collapseToIcon(opts ?? {}),
  );
  ipcMain.handle('mode:preview-collapse-anchor', (_evt, opts?: CollapseOpts) =>
    previewCollapseAnchor(opts ?? {}),
  );

  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.on(
    'resize:start',
    (_evt, payload: { corner: ResizeCorner; cursor: ScreenPoint }) => {
      if (!iconWindow || mode !== 'window') return;
      resizeSession = {
        corner: payload.corner,
        startCursor: payload.cursor,
        origin: iconWindow.getBounds(),
      };
    },
  );

  function applyResize(cursor: ScreenPoint): WindowBounds | null {
    if (!resizeSession || !iconWindow) return null;
    const next = squareResize({
      origin: resizeSession.origin,
      corner: resizeSession.corner,
      cursorDx: cursor.x - resizeSession.startCursor.x,
      cursorDy: cursor.y - resizeSession.startCursor.y,
      minSize: WINDOW_MIN_SIZE_PX,
      maxSize: maxWindowSize(primaryBounds()),
    });
    iconWindow.setBounds(next);
    return next;
  }

  ipcMain.on('resize:move', (_evt, cursor: ScreenPoint) => {
    applyResize(cursor);
  });

  ipcMain.on('resize:end', (_evt, cursor: ScreenPoint) => {
    const final = applyResize(cursor);
    resizeSession = null;
    if (!final) return;
    // Resize from top-left / top-right shifts the window's top-left,
    // but the icon's resting position should NOT follow a resize. Just
    // re-anchor windowOriginAtExpand so the next drag delta is computed
    // from the post-resize position.
    if (windowOriginAtExpand) {
      windowOriginAtExpand = { x: final.x, y: final.y };
    }
    const settings = loadSettings();
    if (settings.trackWindowPosition) {
      saveSettings({ windowBounds: final });
    }
  });

  ipcMain.on('drag:start', (_evt, cursor: ScreenPoint) => {
    if (!iconWindow) return;
    if (mode === 'window') {
      const b = iconWindow.getBounds();
      dragSession = {
        subject: 'window',
        startCursor: cursor,
        startPos: { x: b.x, y: b.y },
        // Capture size ONCE here. drag:move / drag:end reuse this
        // value rather than calling getBounds() again — see the
        // DragSession type comment for the DWM-drift rationale.
        startSize: { width: b.width, height: b.height },
        // Seed the multi-monitor anchor at the start position; updated
        // after each successful move below.
        lastAppliedPos: { x: b.x, y: b.y },
      };
    } else {
      dragSession = {
        subject: 'icon',
        startCursor: cursor,
        startPos: currentIconPosition(),
      };
    }
  });

  ipcMain.on('drag:move', (_evt, cursor: ScreenPoint) => {
    if (!dragSession || !iconWindow) return;
    const next = computeIconPosFromCursor(
      dragSession.startCursor,
      dragSession.startPos,
      cursor,
    );
    if (dragSession.subject === 'window') {
      // Constrain the window to fit fully on the cursor's display.
      // Cross-monitor: hugs the source display's edge until the cursor
      // has moved far enough into the destination that the whole
      // window fits there. Mirrors the icon's drag clamp.
      const final = clampWindowForDrag({
        candidate: next,
        size: dragSession.startSize,
        cursor,
        prevPos: dragSession.lastAppliedPos,
        allDisplays: allDisplayBounds(),
      });
      iconWindow.setBounds({
        x: final.x,
        y: final.y,
        width: dragSession.startSize.width,
        height: dragSession.startSize.height,
      });
      dragSession.lastAppliedPos = final;
    } else {
      const clamped = clampIconForDrag({
        candidate: next,
        cursor,
        prevPos: currentIconPosition(),
        allDisplays: allDisplayBounds(),
      });
      applyIconPosition(clamped);
    }
  });

  ipcMain.on('drag:end', (_evt, cursor: ScreenPoint) => {
    if (!dragSession || !iconWindow) return;
    const dropped = computeIconPosFromCursor(
      dragSession.startCursor,
      dragSession.startPos,
      cursor,
    );
    const session = dragSession;
    dragSession = null;

    if (session.subject === 'window') {
      const snap = snapWindowToCorner(
        dropped,
        { width: session.startSize.width, height: session.startSize.height },
        primaryBounds(),
      );
      // Snap returns positions on the primary display (already
      // on-screen). The unsnapped path uses the same drag clamp as
      // drag:move so a release near a screen edge stays where the
      // user actually saw the window during the drag.
      const final =
        snap?.position ??
        clampWindowForDrag({
          candidate: dropped,
          size: session.startSize,
          cursor,
          prevPos: session.lastAppliedPos,
          allDisplays: allDisplayBounds(),
        });
      const newBounds: WindowBounds = {
        x: final.x,
        y: final.y,
        width: session.startSize.width,
        height: session.startSize.height,
      };
      iconWindow.setBounds(newBounds);
      // Shift pendingIconPosition by the same delta so the icon
      // returns to its original spot offset by however much the window
      // moved. (User spec: "when moved, move the icon position
      // relatively"). Then re-anchor windowOriginAtExpand so the next
      // drag delta is computed from the new position.
      if (pendingIconPosition && windowOriginAtExpand) {
        const dx = final.x - windowOriginAtExpand.x;
        const dy = final.y - windowOriginAtExpand.y;
        pendingIconPosition = {
          x: pendingIconPosition.x + dx,
          y: pendingIconPosition.y + dy,
        };
      }
      windowOriginAtExpand = { x: final.x, y: final.y };
      // Window position persistence is opt-in; only save when the
      // user has enabled it. Sub-feature 9 wires the setting UI; until
      // then, the toggle is set via settings.json directly for testing.
      const settings = loadSettings();
      if (settings.trackWindowPosition) {
        saveSettings({ windowBounds: newBounds });
      }
    } else {
      const snapped = snapToCorner(dropped, primaryBounds());
      // Snap returns corner-padded positions on the primary display; the
      // unsnapped path uses the cross-display drag clamp so a release
      // near a monitor seam stays where the user actually sees the icon.
      const final =
        snapped?.position ??
        clampIconForDrag({
          candidate: dropped,
          cursor,
          prevPos: currentIconPosition(),
          allDisplays: allDisplayBounds(),
        });
      applyIconPosition(final);
      saveSettings({ iconPosition: final });
    }
  });
}

// Single-instance lock per plan/tech-stack.md.
//
// Per plan/window.md: "if collapsed, auto-expand; if window already
// open, focus. If first instance is in drag mode when 2nd launch fires,
// exit drag then expand."
//
// The "exit drag then expand" case falls out naturally from expanding:
// the IconView (which owns the renderer-side drag-mode toggle) unmounts
// when mode flips to 'window', and a fresh IconView mounts with drag
// mode off on the next collapse. We do clear any active mid-mouse-drag
// session here so a stranded dragSession doesn't apply phantom moves
// after the expand.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!iconWindow) return;
    if (mode === 'window') {
      // Restore from minimize if needed and bring to front.
      if (iconWindow.isMinimized()) iconWindow.restore();
      iconWindow.focus();
      return;
    }
    // mode === 'icon'. Clear any in-flight drag, then expand.
    dragSession = null;
    expandToWindow();
  });

  void app.whenReady().then(() => {
    registerIpc();
    createIconWindow();

    screen.on('display-metrics-changed', snapBackIfOffScreen);
    screen.on('display-removed', snapBackIfOffScreen);
    screen.on('display-added', snapBackIfOffScreen);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createIconWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
