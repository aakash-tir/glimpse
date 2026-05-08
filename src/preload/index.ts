import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../shared/settings-store';
import type { ScreenPoint } from '../shared/drag';
import type { Mode, ModeChange } from '../shared/mode';
import type { ResizeCorner } from '../shared/window-position';
import type { DataSnapshot } from '../shared/data-snapshot';
import type { ResolvedTheme } from '../shared/theme';

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
  resetIconPosition: (): Promise<void> =>
    ipcRenderer.invoke('settings:reset-icon-position'),
  refreshData: (): Promise<void> => ipcRenderer.invoke('data:refresh'),
  onSettingsChanged: (cb: (settings: Settings) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      settings: Settings,
    ): void => cb(settings);
    ipcRenderer.on('settings:changed', handler);
    return () => {
      ipcRenderer.off('settings:changed', handler);
    };
  },
  dragStart: (cursor: ScreenPoint): void =>
    ipcRenderer.send('drag:start', cursor),
  dragMove: (cursor: ScreenPoint): void =>
    ipcRenderer.send('drag:move', cursor),
  dragEnd: (cursor: ScreenPoint): void => ipcRenderer.send('drag:end', cursor),
  getMode: (): Promise<Mode> => ipcRenderer.invoke('mode:get'),
  expand: (): Promise<ModeChange> => ipcRenderer.invoke('mode:expand'),
  collapse: (opts?: { resetToDefault?: boolean }): Promise<ModeChange> =>
    ipcRenderer.invoke('mode:collapse', opts),
  previewCollapseAnchor: (opts?: {
    resetToDefault?: boolean;
  }): Promise<{ x: number; y: number }> =>
    ipcRenderer.invoke('mode:preview-collapse-anchor', opts),
  quit: (): void => ipcRenderer.send('app:quit'),
  resizeStart: (corner: ResizeCorner, cursor: ScreenPoint): void =>
    ipcRenderer.send('resize:start', { corner, cursor }),
  resizeMove: (cursor: ScreenPoint): void =>
    ipcRenderer.send('resize:move', cursor),
  resizeEnd: (cursor: ScreenPoint): void =>
    ipcRenderer.send('resize:end', cursor),
  onModeChanged: (cb: (change: ModeChange) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, change: ModeChange): void =>
      cb(change);
    ipcRenderer.on('mode:changed', handler);
    return () => {
      ipcRenderer.off('mode:changed', handler);
    };
  },
  getTheme: (): Promise<ResolvedTheme> => ipcRenderer.invoke('theme:get'),
  onThemeChanged: (cb: (theme: ResolvedTheme) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      theme: ResolvedTheme,
    ): void => cb(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => {
      ipcRenderer.off('theme:changed', handler);
    };
  },
  getData: (): Promise<DataSnapshot> => ipcRenderer.invoke('data:get'),
  onDataChanged: (cb: (snapshot: DataSnapshot) => void): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      snapshot: DataSnapshot,
    ): void => cb(snapshot);
    ipcRenderer.on('data:changed', handler);
    return () => {
      ipcRenderer.off('data:changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('glimpse', api);

export type GlimpseApi = typeof api;
