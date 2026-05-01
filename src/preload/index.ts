import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../shared/settings-store';
import type { ScreenPoint } from '../shared/drag';
import type { Mode, ModeChange } from '../shared/mode';

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
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
  onModeChanged: (cb: (change: ModeChange) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, change: ModeChange): void =>
      cb(change);
    ipcRenderer.on('mode:changed', handler);
    return () => {
      ipcRenderer.off('mode:changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('glimpse', api);

export type GlimpseApi = typeof api;
