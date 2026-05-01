import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../shared/settings-store';
import type { ScreenPoint } from '../shared/drag';

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
  dragStart: (cursor: ScreenPoint): void =>
    ipcRenderer.send('drag:start', cursor),
  dragMove: (cursor: ScreenPoint): void =>
    ipcRenderer.send('drag:move', cursor),
  dragEnd: (cursor: ScreenPoint): void => ipcRenderer.send('drag:end', cursor),
};

contextBridge.exposeInMainWorld('glimpse', api);

export type GlimpseApi = typeof api;
