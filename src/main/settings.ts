import { join } from 'node:path';
import { app } from 'electron';
import {
  DEFAULT_SETTINGS,
  readSettingsFromFile,
  writeSettingsToFile,
  type Settings,
} from '../shared/settings-store';

export type {
  Settings,
  Units,
  TimeFormat,
  ThemeOverride,
  IconPosition,
  WindowBounds,
} from '../shared/settings-store';
export { DEFAULT_SETTINGS } from '../shared/settings-store';

let cached: Settings | null = null;

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): Settings {
  if (cached) return cached;
  cached = readSettingsFromFile(settingsPath());
  return cached;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = loadSettings();
  const next: Settings = { ...current, ...patch };
  writeSettingsToFile(settingsPath(), next);
  cached = next;
  return next;
}

export function resetSettings(): Settings {
  writeSettingsToFile(settingsPath(), DEFAULT_SETTINGS);
  cached = { ...DEFAULT_SETTINGS };
  return cached;
}

// Test-only helper to invalidate the in-process cache between tests.
export function _resetSettingsCacheForTests(): void {
  cached = null;
}
