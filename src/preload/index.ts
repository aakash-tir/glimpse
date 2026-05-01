import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../shared/settings-store';

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
};

contextBridge.exposeInMainWorld('glimpse', api);

export type GlimpseApi = typeof api;
