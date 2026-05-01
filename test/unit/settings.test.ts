import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  readSettingsFromFile,
  writeSettingsToFile,
  type Settings,
} from '../../src/shared/settings-store';

let tmp: string;
let file: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'glimpse-settings-'));
  file = join(tmp, 'settings.json');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('mergeWithDefaults', () => {
  it('returns defaults for non-object input', () => {
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults('string')).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults(42)).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults([])).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial valid fields onto defaults', () => {
    const merged = mergeWithDefaults({ units: 'imperial', timeFormat: '12h' });
    expect(merged.units).toBe('imperial');
    expect(merged.timeFormat).toBe('12h');
    expect(merged.iconPosition).toBeNull();
    expect(merged.themeOverride).toBe('auto');
  });

  it('rejects fields with wrong shape and uses defaults instead', () => {
    const merged = mergeWithDefaults({
      units: 'kelvin',
      timeFormat: 7,
      iconPosition: { x: 'oops' },
      moonPhaseSlideEnabled: 'yes',
      themeOverride: 'sepia',
      trackWindowPosition: 1,
      windowBounds: { x: 0, y: 0 },
      onboardingCompleted: null,
    });
    expect(merged).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts a valid iconPosition', () => {
    const merged = mergeWithDefaults({ iconPosition: { x: 100, y: 200 } });
    expect(merged.iconPosition).toEqual({ x: 100, y: 200 });
  });

  it('accepts an explicit null iconPosition', () => {
    const merged = mergeWithDefaults({ iconPosition: null });
    expect(merged.iconPosition).toBeNull();
  });
});

describe('readSettingsFromFile', () => {
  it('returns defaults when the file is absent', () => {
    expect(readSettingsFromFile(file)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults without crashing when the file is corrupt JSON', () => {
    writeFileSync(file, '{not json', 'utf-8');
    expect(readSettingsFromFile(file)).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a partial settings file with defaults', () => {
    writeFileSync(
      file,
      JSON.stringify({ iconPosition: { x: 10, y: 20 }, themeOverride: 'dark' }),
      'utf-8',
    );
    const result = readSettingsFromFile(file);
    expect(result.iconPosition).toEqual({ x: 10, y: 20 });
    expect(result.themeOverride).toBe('dark');
    expect(result.units).toBe('metric');
    expect(result.onboardingCompleted).toBe(false);
  });

  it('round-trips through writeSettingsToFile', () => {
    const written: Settings = {
      ...DEFAULT_SETTINGS,
      units: 'imperial',
      iconPosition: { x: 50, y: 60 },
      onboardingCompleted: true,
    };
    writeSettingsToFile(file, written);
    expect(readSettingsFromFile(file)).toEqual(written);
  });

  it('creates the parent directory on write if it does not exist', () => {
    const nested = join(tmp, 'nested', 'dir', 'settings.json');
    writeSettingsToFile(nested, DEFAULT_SETTINGS);
    expect(readSettingsFromFile(nested)).toEqual(DEFAULT_SETTINGS);
  });
});
