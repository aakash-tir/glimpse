import { contextBridge, ipcRenderer } from 'electron';
import type {
  BrowserGeolocation,
  LocationOverride,
  Settings,
} from '../shared/settings-store';
import type { ScreenPoint } from '../shared/drag';
import type { Mode, ModeChange } from '../shared/mode';
import type { ResizeCorner } from '../shared/window-position';
import type { DataSnapshot } from '../shared/data-snapshot';
import type { ResolvedTheme } from '../shared/theme';
import type { OnboardingFinishReason } from '../shared/onboarding';

// Mirrors the GeocodingMatch shape from main/data/geocoding.ts. Kept
// inline so the preload layer doesn't need to import from main/.
export type GeocodingMatch = {
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  admin1: string | null;
};

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:set', patch),
  resetIconPosition: (): Promise<void> =>
    ipcRenderer.invoke('settings:reset-icon-position'),
  refreshData: (): Promise<void> => ipcRenderer.invoke('data:refresh'),
  setLocationOverride: (override: LocationOverride): Promise<void> =>
    ipcRenderer.invoke('location:set-override', override),
  clearLocationOverride: (detectedCity: string): Promise<void> =>
    ipcRenderer.invoke('location:clear-override', detectedCity),
  setBrowserCoords: (coords: BrowserGeolocation | null): Promise<void> =>
    ipcRenderer.invoke('location:set-browser-coords', coords),
  markLocationPermissionAsked: (): Promise<void> =>
    ipcRenderer.invoke('location:mark-permission-asked'),
  geocodeLocation: (name: string): Promise<GeocodingMatch | null> =>
    ipcRenderer.invoke('location:geocode', name),
  onSettingsChanged: (cb: (settings: Settings) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, settings: Settings): void =>
      cb(settings);
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
  // ---- Onboarding ----
  // Synchronous so the renderer knows at first paint whether to show
  // the tutorial — avoids flashing the icon view inside the larger
  // onboarding panel.
  isOnboardingActive: (): boolean =>
    ipcRenderer.sendSync('onboarding:get-sync') as boolean,
  onboardingFinish: (reason: OnboardingFinishReason): Promise<void> =>
    ipcRenderer.invoke('onboarding:finish', reason),
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
