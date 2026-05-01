import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
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
  collapseTargetFromWindow,
  expandFromIcon,
  maxWindowSize,
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
  // looking at it). The next collapse will re-clamp via
  // collapseTargetFromWindow.
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

type DragSession = {
  startCursor: ScreenPoint;
  startPos: { x: number; y: number };
  subject: 'icon' | 'window';
};

let dragSession: DragSession | null = null;

type ResizeSession = {
  corner: ResizeCorner;
  startCursor: ScreenPoint;
  origin: WindowBounds;
};

let resizeSession: ResizeSession | null = null;

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
  const bounds = expandFromIcon(iconPos, primaryBounds());
  applyWindowBounds(bounds);
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

function nextIconPositionForCollapse(opts: CollapseOpts): IconPosition {
  if (!iconWindow) return defaultIconPosition(primaryBounds());
  if (opts.resetToDefault) return defaultIconPosition(primaryBounds());
  const winBounds = iconWindow.getBounds();
  return collapseTargetFromWindow(winBounds, primaryBounds());
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
        startCursor: cursor,
        startPos: { x: b.x, y: b.y },
        subject: 'window',
      };
    } else {
      dragSession = {
        startCursor: cursor,
        startPos: currentIconPosition(),
        subject: 'icon',
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
      const b = iconWindow.getBounds();
      iconWindow.setBounds({
        x: next.x,
        y: next.y,
        width: b.width,
        height: b.height,
      });
    } else {
      applyIconPosition(next);
    }
  });

  ipcMain.on('drag:end', (_evt, cursor: ScreenPoint) => {
    if (!dragSession || !iconWindow) return;
    const dropped = computeIconPosFromCursor(
      dragSession.startCursor,
      dragSession.startPos,
      cursor,
    );
    const subject = dragSession.subject;
    dragSession = null;

    if (subject === 'window') {
      const b = iconWindow.getBounds();
      const snap = snapWindowToCorner(
        dropped,
        { width: b.width, height: b.height },
        primaryBounds(),
      );
      const final = snap?.position ?? dropped;
      const newBounds: WindowBounds = {
        x: final.x,
        y: final.y,
        width: b.width,
        height: b.height,
      };
      iconWindow.setBounds(newBounds);
      // Window position persistence is opt-in; only save when the
      // user has enabled it. Sub-feature 9 wires the setting UI; until
      // then, the toggle is set via settings.json directly for testing.
      const settings = loadSettings();
      if (settings.trackWindowPosition) {
        saveSettings({ windowBounds: newBounds });
      }
    } else {
      const snapped = snapToCorner(dropped, primaryBounds());
      const final = snapped?.position ?? dropped;
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
