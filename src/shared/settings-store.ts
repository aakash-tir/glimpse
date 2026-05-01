import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Units = 'metric' | 'imperial';
export type TimeFormat = '12h' | '24h';
export type ThemeOverride = 'auto' | 'light' | 'dark';

export type IconPosition = { x: number; y: number };
export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Settings = {
  units: Units;
  timeFormat: TimeFormat;
  iconPosition: IconPosition | null;
  moonPhaseSlideEnabled: boolean;
  themeOverride: ThemeOverride;
  trackWindowPosition: boolean;
  windowBounds: WindowBounds | null;
  onboardingCompleted: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  timeFormat: '24h',
  iconPosition: null,
  moonPhaseSlideEnabled: false,
  themeOverride: 'auto',
  trackWindowPosition: false,
  windowBounds: null,
  onboardingCompleted: false,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnits(v: unknown): v is Units {
  return v === 'metric' || v === 'imperial';
}
function isTimeFormat(v: unknown): v is TimeFormat {
  return v === '12h' || v === '24h';
}
function isThemeOverride(v: unknown): v is ThemeOverride {
  return v === 'auto' || v === 'light' || v === 'dark';
}
function isIconPosition(v: unknown): v is IconPosition {
  return isPlainObject(v) && typeof v.x === 'number' && typeof v.y === 'number';
}
function isWindowBounds(v: unknown): v is WindowBounds {
  return (
    isPlainObject(v) &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  );
}

export function mergeWithDefaults(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!isPlainObject(raw)) return out;

  if (isUnits(raw.units)) out.units = raw.units;
  if (isTimeFormat(raw.timeFormat)) out.timeFormat = raw.timeFormat;
  if (raw.iconPosition === null || isIconPosition(raw.iconPosition))
    out.iconPosition = raw.iconPosition;
  if (typeof raw.moonPhaseSlideEnabled === 'boolean')
    out.moonPhaseSlideEnabled = raw.moonPhaseSlideEnabled;
  if (isThemeOverride(raw.themeOverride)) out.themeOverride = raw.themeOverride;
  if (typeof raw.trackWindowPosition === 'boolean')
    out.trackWindowPosition = raw.trackWindowPosition;
  if (raw.windowBounds === null || isWindowBounds(raw.windowBounds))
    out.windowBounds = raw.windowBounds;
  if (typeof raw.onboardingCompleted === 'boolean')
    out.onboardingCompleted = raw.onboardingCompleted;

  return out;
}

export function readSettingsFromFile(filePath: string): Settings {
  let raw: unknown;
  try {
    const contents = readFileSync(filePath, 'utf-8');
    raw = JSON.parse(contents);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return mergeWithDefaults(raw);
}

export function writeSettingsToFile(
  filePath: string,
  settings: Settings,
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}
