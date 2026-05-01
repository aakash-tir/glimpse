import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  defaultIconPosition,
  ICON_OFFSET_X,
  ICON_OFFSET_Y,
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
} from '../shared/window-position';
import type { IconPosition, WindowBounds } from '../shared/settings-store';
import type { Mode } from '../shared/mode';
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
  startIcon: IconPosition;
};

let dragSession: DragSession | null = null;

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

function expandToWindow(): Mode {
  if (!iconWindow || mode === 'window') return mode;
  const iconPos = currentIconPosition();
  const bounds = expandFromIcon(iconPos, primaryBounds());
  applyWindowBounds(bounds);
  mode = 'window';
  iconWindow.webContents.send('mode:changed', mode);
  return mode;
}

function collapseToIcon(): Mode {
  if (!iconWindow || mode === 'icon') return mode;
  const bounds = iconWindow.getBounds();
  const iconPos = collapseTargetFromWindow(bounds, primaryBounds());
  applyIconPosition(iconPos);
  saveSettings({ iconPosition: iconPos });
  mode = 'icon';
  iconWindow.webContents.send('mode:changed', mode);
  return mode;
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_evt, patch) => saveSettings(patch));

  ipcMain.handle('mode:get', () => mode);
  ipcMain.handle('mode:expand', () => expandToWindow());
  ipcMain.handle('mode:collapse', () => collapseToIcon());

  ipcMain.on('drag:start', (_evt, cursor: ScreenPoint) => {
    dragSession = {
      startCursor: cursor,
      startIcon: currentIconPosition(),
    };
  });

  ipcMain.on('drag:move', (_evt, cursor: ScreenPoint) => {
    if (!dragSession) return;
    const next = computeIconPosFromCursor(
      dragSession.startCursor,
      dragSession.startIcon,
      cursor,
    );
    applyIconPosition(next);
  });

  ipcMain.on('drag:end', (_evt, cursor: ScreenPoint) => {
    if (!dragSession) return;
    const dropped = computeIconPosFromCursor(
      dragSession.startCursor,
      dragSession.startIcon,
      cursor,
    );
    dragSession = null;

    const snapped = snapToCorner(dropped, primaryBounds());
    const final = snapped?.position ?? dropped;
    applyIconPosition(final);
    saveSettings({ iconPosition: final });
  });
}

// Single-instance lock per plan/tech-stack.md. M2 ships the bare lock —
// a second launch is acquired by the existing primary process via the
// `second-instance` event but is otherwise a no-op (M3 will wire the
// expand / focus / exit-drag-then-expand behavior).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Intentionally empty until the M3 sub-feature that wires
    // collapsed → expand / open → focus / drag-mode → exit-then-expand.
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
