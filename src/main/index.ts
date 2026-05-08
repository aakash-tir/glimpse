import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  powerMonitor,
  screen,
} from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchGeolocation } from './data/geolocation';
import { fetchForecast } from './data/open-meteo';
import { fetchKp } from './data/noaa-swpc';
import { DataStore } from './data/store';
import { TickScheduler } from '../shared/scheduler';
import type { DataSnapshot } from '../shared/data-snapshot';
import {
  clampIconForDrag,
  defaultIconPosition,
  displayForPoint,
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
  iconForCollapsedWindow,
  maxSizeForResize,
  maxWindowSize,
  resolveWindowBoundsForExpand,
  snapWindowToCorner,
  snapWindowToEdge,
  squareResize,
  WINDOW_MIN_SIZE_PX,
  type ResizeCorner,
} from '../shared/window-position';
import type { IconPosition, WindowBounds } from '../shared/settings-store';
import type { Mode, ModeChange } from '../shared/mode';
import { resolveTheme, type ResolvedTheme } from '../shared/theme';
import { loadSettings, saveSettings } from './settings';

const __dirname = dirname(fileURLToPath(import.meta.url));

let iconWindow: BrowserWindow | null = null;
let mode: Mode = 'icon';

// Data layer — composed at app.whenReady so the constructors don't
// run during test imports of this module. The store fans out to the
// renderer via IPC ('data:get' / 'data:changed'). The scheduler runs
// the refresh loop on the :05 cadence with sleep/wake catch-up wired
// to powerMonitor.
const dataStore = new DataStore({
  fetchGeolocation,
  fetchForecast,
  fetchKp,
});
const dataScheduler = new TickScheduler(async () => {
  const result = await dataStore.refresh();
  // On weather failure, retry on the exponential-backoff schedule
  // (5 → 10 → 20 → 40 → 60 min) instead of waiting for the next
  // hourly :05 tick. Recovery on success returns void here so the
  // scheduler resumes its default cadence.
  if (!result.weatherOk && result.nextRetryMinutes !== null) {
    return { nextDelayMs: result.nextRetryMinutes * 60_000 };
  }
  return undefined;
});

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
  // looking at it). The next collapse will pick a sensible icon
  // position via collapseTargetFromWindow (display-aware).
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

// In-session window size. Updated when the user resizes; consumed on
// the next expand to reuse the size at the icon's location even when
// trackWindowPosition is off. Disk persistence still gated by the
// toggle. Reset on app start (this is intentionally NOT in
// settings.json) and cleared by reset-to-default collapse.
let lastWindowSize: number | null = null;

// Captured at expandToWindow: where the icon was when the user opened
// the panel. Used by nextIconPositionForCollapse for cases B1 and B2
// (no drag → return exact original spot). Cleared on collapse.
let expandTimeIconPosition: IconPosition | null = null;
// Set true when a window-mode drag completes; reset to false on each
// expand. Resize does NOT set this — per spec B2, resizing alone
// keeps the icon at its expand-time spot. drag:end sets it.
let windowDragged = false;
// The last bounds we've SET on the window in window mode, in content
// coords. iconForCollapsedWindow uses this instead of
// getContentBounds() because the Windows DWM frame correction shifts
// getContentBounds by a few pixels on the read-back, breaking the
// "flush against edge" detection (a window we set to x=0 reads back
// as x=12 or so). Updated on every applyWindowBounds /
// drag-end-setBounds / resize-end-setBounds. Reset on collapse.
let lastWindowBounds: WindowBounds | null = null;

function currentIconPosition(): IconPosition {
  if (!iconWindow) {
    return defaultIconPosition(primaryBounds());
  }
  const bounds = iconWindow.getContentBounds();
  return {
    x: bounds.x + ICON_OFFSET_X,
    y: bounds.y + ICON_OFFSET_Y,
  };
}

function applyIconPosition(pos: IconPosition): void {
  if (!iconWindow) return;
  // Callers are responsible for clamping (drag handlers use
  // clampIconForDrag for cross-display behavior; collapse paths use
  // iconForCollapsedWindow which clamps to the window's display).
  // setContentBounds (rather than setBounds) so the icon-mode
  // window's CONTENT area lands at the requested position even when
  // a chunk of the (transparent) window extends off-screen — e.g.
  // for B3b left-edge midpoint, the window extends to x=-164 but
  // only the painted icon glyph (at internal offset 180) needs to
  // be on-screen.
  const win = windowPositionForIcon(pos);
  iconWindow.setContentBounds({
    x: win.x,
    y: win.y,
    width: ICON_WINDOW_WIDTH,
    height: ICON_WINDOW_HEIGHT,
  });
}

function applyWindowBounds(bounds: WindowBounds): void {
  if (!iconWindow) return;
  iconWindow.setBounds(bounds);
  lastWindowBounds = bounds;
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
    const b = iconWindow.getContentBounds();
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
    // In-session size carry: if the user resized this session, reuse
    // that size at the icon's location even with trackWindowPosition
    // off. ?? null avoids passing 0 / NaN to expandFromIcon's
    // sizeOverride.
    sessionSize: lastWindowSize ?? undefined,
  });
  applyWindowBounds(bounds);
  // Capture the icon's pre-expand position for the no-drag /
  // resize-only collapse cases (B1 / B2).
  expandTimeIconPosition = iconPos;
  windowDragged = false;
  mode = 'window';
  // Per plan/data-sources.md § Refresh policy: "On window open, fetch
  // all data immediately." "Window" here means the expanded panel
  // (per the project glossary), not the icon. Kicked off async so the
  // expand animation isn't blocked; the renderer receives the fresh
  // snapshot via the data:changed listener when fetch completes. No
  // debounce — rapid toggle is uncommon and personal-use APIs are all
  // generous.
  void dataStore.refresh();
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
// See manual-tests-review.md (and plan/window.md) for the spec — A1
// for reset-to-default, B1/B2/B3 for in-place.
//
//   - A1 (resetToDefault): always default top-right of primary.
//   - B1/B2 (no drag since expand): exact expand-time icon position.
//     Resize alone never relocates the icon; only an actual window
//     drag does (windowDragged flag).
//   - B3 (drag occurred): iconForCollapsedWindow inspects the final
//     window bounds — flush against two edges → corner; one edge →
//     edge midpoint; otherwise → window center. All on whichever
//     display the window's center is on (multi-monitor aware).
//   - Fallback: icon at the icon's current location in the unlikely
//     event we're collapsing without an active window-mode session.
function nextIconPositionForCollapse(opts: CollapseOpts): IconPosition {
  if (!iconWindow) return defaultIconPosition(primaryBounds());
  if (opts.resetToDefault) return defaultIconPosition(primaryBounds());
  if (mode === 'window') {
    if (!windowDragged && expandTimeIconPosition) {
      return expandTimeIconPosition;
    }
    // Use the LAST BOUNDS WE SET, not the OS read-back. Windows DWM
    // shifts getContentBounds by ~7 px from the set value on
    // frameless transparent windows; the snap targets are computed
    // from set bounds so the flush-against-edge check has to match
    // the same reference frame.
    const bounds = lastWindowBounds ?? iconWindow.getContentBounds();
    return iconForCollapsedWindow({
      bounds,
      primary: primaryBounds(),
      allDisplays: allDisplayBounds(),
    });
  }
  return currentIconPosition();
}

function previewCollapseAnchor(opts: CollapseOpts): { x: number; y: number } {
  if (!iconWindow || mode !== 'window') return { x: 0, y: 0 };
  const winBounds = iconWindow.getContentBounds();
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
    const b = iconWindow.getContentBounds();
    return modeChangePayload('icon', b, null);
  }
  const winBounds = iconWindow.getContentBounds();
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
    // A1: clear icon position AND in-session size so the next expand
    // is fully default-default. Also clear saved windowBounds so a
    // relaunch doesn't restore the prior size + position.
    saveSettings({ iconPosition: null, windowBounds: null });
    lastWindowSize = null;
  } else {
    saveSettings({ iconPosition: iconPos });
  }
  expandTimeIconPosition = null;
  windowDragged = false;
  lastWindowBounds = null;
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

function currentResolvedTheme(): ResolvedTheme {
  const settings = loadSettings();
  return resolveTheme(settings.themeOverride, nativeTheme.shouldUseDarkColors);
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_evt, patch) => {
    const prevOverride = loadSettings().themeOverride;
    const next = saveSettings(patch);
    // Broadcast so every renderer-side reader (window-view's units /
    // time-format / moon toggles, etc.) updates live without each one
    // re-fetching. Settings changes from the Settings slide are the
    // primary trigger for this push.
    iconWindow?.webContents.send('settings:changed', next);
    // If the user changed their themeOverride, push the newly-resolved
    // theme too so the SlideDeck cross-fade fires immediately rather
    // than waiting for the next nativeTheme.updated event.
    if (next.themeOverride !== prevOverride) {
      iconWindow?.webContents.send('theme:changed', currentResolvedTheme());
    }
    return next;
  });

  ipcMain.handle('theme:get', () => currentResolvedTheme());

  // M7: Reset icon position — clears persisted iconPosition AND moves
  // the window back to the default top-right corner. The settings
  // write is broadcast so Settings slide updates its own state.
  ipcMain.handle('settings:reset-icon-position', () => {
    const next = saveSettings({ iconPosition: null });
    iconWindow?.webContents.send('settings:changed', next);
    if (iconWindow && mode === 'icon') {
      const def = defaultIconPosition(primaryBounds());
      applyIconPosition(def);
    }
  });

  // M7: Manual refresh — kicks the data scheduler so the user can
  // force a fresh fetch from the Settings slide.
  ipcMain.handle('data:refresh', async () => {
    await dataStore.refresh();
  });

  ipcMain.handle('data:get', () => dataStore.getSnapshot());

  // Renderer subscribes via the preload's onDataChanged. We forward
  // every snapshot push to whichever window is currently showing.
  dataStore.subscribe((snapshot: DataSnapshot) => {
    iconWindow?.webContents.send('data:changed', snapshot);
  });

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
        origin: iconWindow.getContentBounds(),
      };
    },
  );

  function applyResize(cursor: ScreenPoint): WindowBounds | null {
    if (!resizeSession || !iconWindow) return null;
    // Cap the new size so the bounds stay on the display containing
    // the diagonal-fixed corner (the corner that doesn't move during
    // this resize). maxWindowSize is the absolute cap (1/6 display
    // floor); maxSizeForResize is the per-corner per-display cap that
    // prevents spillover off the screen edge.
    const originCenter = {
      x: resizeSession.origin.x + resizeSession.origin.width / 2,
      y: resizeSession.origin.y + resizeSession.origin.height / 2,
    };
    const display = displayForPoint(
      originCenter,
      allDisplayBounds(),
      primaryBounds(),
    );
    const dispMax = maxSizeForResize({
      corner: resizeSession.corner,
      origin: resizeSession.origin,
      display,
    });
    const next = squareResize({
      origin: resizeSession.origin,
      corner: resizeSession.corner,
      cursorDx: cursor.x - resizeSession.startCursor.x,
      cursorDy: cursor.y - resizeSession.startCursor.y,
      minSize: WINDOW_MIN_SIZE_PX,
      maxSize: Math.max(
        WINDOW_MIN_SIZE_PX,
        Math.min(maxWindowSize(primaryBounds()), dispMax),
      ),
    });
    iconWindow.setBounds(next);
    lastWindowBounds = next;
    return next;
  }

  ipcMain.on('resize:move', (_evt, cursor: ScreenPoint) => {
    applyResize(cursor);
  });

  ipcMain.on('resize:end', (_evt, cursor: ScreenPoint) => {
    const final = applyResize(cursor);
    resizeSession = null;
    if (!final) return;
    // Carry the new size in-memory so the next collapse → expand cycle
    // reuses it (option (b) from the manual-tests-review writeup).
    // Disk persistence still requires trackWindowPosition.
    lastWindowSize = final.width;
    const settings = loadSettings();
    if (settings.trackWindowPosition) {
      saveSettings({ windowBounds: final });
    }
  });

  ipcMain.on('drag:start', (_evt, cursor: ScreenPoint) => {
    if (!iconWindow) return;
    if (mode === 'window') {
      const b = iconWindow.getContentBounds();
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
      const moved: WindowBounds = {
        x: final.x,
        y: final.y,
        width: dragSession.startSize.width,
        height: dragSession.startSize.height,
      };
      iconWindow.setBounds(moved);
      lastWindowBounds = moved;
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
      // A real window-drag gesture has now completed — flag it so
      // the next collapse uses iconForCollapsedWindow (B3) rather
      // than the expand-time position (B1).
      windowDragged = true;
      // Snap considers the corners + edges of EVERY connected
      // display, so a release near the secondary monitor's bottom-
      // right snaps there. Corner takes priority over edge because
      // a corner is two-edges-flush — the more specific match.
      // The unsnapped path uses the drag clamp so a release near a
      // screen edge keeps the window where the user actually saw it.
      const cornerSnap = snapWindowToCorner(
        dropped,
        { width: session.startSize.width, height: session.startSize.height },
        allDisplayBounds(),
      );
      const edgeSnap = cornerSnap
        ? null
        : snapWindowToEdge(
            dropped,
            {
              width: session.startSize.width,
              height: session.startSize.height,
            },
            allDisplayBounds(),
          );
      const final =
        cornerSnap?.position ??
        edgeSnap?.position ??
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
      lastWindowBounds = newBounds;
      // Window position persistence is opt-in; only save when the
      // user has enabled it. Sub-feature 9 wires the setting UI; until
      // then, the toggle is set via settings.json directly for testing.
      // (Drag doesn't change size, so lastWindowSize doesn't need an
      // update here — the collapse target is now derived from window
      // bounds via iconForCollapsedWindow.)
      const settings = loadSettings();
      if (settings.trackWindowPosition) {
        saveSettings({ windowBounds: newBounds });
      }
    } else {
      // Snap considers each display's 4 corners; release near the
      // secondary monitor's bottom-left snaps to that corner with the
      // same 16 px padding rule. The unsnapped path uses the cross-
      // display drag clamp so a release near a monitor seam stays
      // where the user actually sees the icon.
      const snapped = snapToCorner(dropped, allDisplayBounds());
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

    // Kick off the immediate first fetch and start the :05 cadence.
    // Per spec: fetch all data immediately on app start (covers the
    // "fetch on window open" requirement since the icon window is
    // always present), then refresh on the hourly clock-aligned tick.
    void dataStore.refresh();
    dataScheduler.start();
    // Fire an extra refresh on resume if the system slept past at
    // least one tick window — see TickScheduler.notifyResume.
    powerMonitor.on('resume', () => dataScheduler.notifyResume());

    // Live theme switching: push the resolved theme any time the host
    // OS toggles dark mode (or any other native-theme attribute the
    // user might bind a system-wide hotkey to). When the user has
    // themeOverride='auto' this is what keeps the Settings slide in
    // sync with Windows; when override is locked light/dark the push
    // still fires but the resolved value won't change.
    nativeTheme.on('updated', () => {
      iconWindow?.webContents.send('theme:changed', currentResolvedTheme());
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createIconWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
