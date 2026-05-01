import { app, BrowserWindow, screen, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  defaultIconPosition,
  ICON_SIZE,
  resolveIconPosition,
  type DisplayBounds,
} from '../shared/icon-position';
import { loadSettings, saveSettings } from './settings';

const __dirname = dirname(fileURLToPath(import.meta.url));

let iconWindow: BrowserWindow | null = null;

function primaryBounds(): DisplayBounds {
  return screen.getPrimaryDisplay().workArea;
}

function allDisplayBounds(): DisplayBounds[] {
  return screen.getAllDisplays().map((d) => d.workArea);
}

function createIconWindow(): void {
  const settings = loadSettings();
  const pos = resolveIconPosition(
    settings.iconPosition,
    primaryBounds(),
    allDisplayBounds(),
  );

  iconWindow = new BrowserWindow({
    width: ICON_SIZE,
    height: ICON_SIZE,
    x: pos.x,
    y: pos.y,
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
  const settings = loadSettings();
  const resolved = resolveIconPosition(
    settings.iconPosition,
    primaryBounds(),
    allDisplayBounds(),
  );
  iconWindow.setBounds({ ...resolved, width: ICON_SIZE, height: ICON_SIZE });

  // If the resolved position is the default (saved was off-screen), clear
  // the saved position so future launches use the default until the user
  // moves the icon again.
  if (settings.iconPosition && resolved !== settings.iconPosition) {
    const isDefault =
      resolved.x === defaultIconPosition(primaryBounds()).x &&
      resolved.y === defaultIconPosition(primaryBounds()).y;
    if (isDefault) saveSettings({ iconPosition: null });
  }
}

function registerIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_evt, patch) => saveSettings(patch));
}

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
