import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../shared/settings-store';
import type { ScreenPoint } from '../shared/drag';
import type { Mode } from '../shared/mode';

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
  expand: (): Promise<Mode> => ipcRenderer.invoke('mode:expand'),
  collapse: (): Promise<Mode> => ipcRenderer.invoke('mode:collapse'),
  onModeChanged: (cb: (mode: Mode) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, mode: Mode): void =>
      cb(mode);
    ipcRenderer.on('mode:changed', handler);
    return () => {
      ipcRenderer.off('mode:changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('glimpse', api);

export type GlimpseApi = typeof api;
