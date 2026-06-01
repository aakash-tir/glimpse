import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  type Settings,
} from '../../src/shared/settings-store';
import {
  readSettingsFromFile,
  writeSettingsToFile,
} from '../../src/main/settings-fs';

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

  it('accepts the new location-related fields', () => {
    const merged = mergeWithDefaults({
      advancedLocationEnabled: true,
      locationOverrides: [
        {
          detectedCity: 'Kelowna',
          city: 'Kelowna Airport',
          latitude: 49.96,
          longitude: -119.38,
        },
      ],
      browserGeolocation: {
        latitude: 50.0,
        longitude: -119.3,
        capturedAt: '2026-05-08T11:00:00Z',
      },
      locationPermissionAsked: true,
    });
    expect(merged.advancedLocationEnabled).toBe(true);
    expect(merged.locationOverrides).toHaveLength(1);
    expect(merged.locationOverrides[0]?.city).toBe('Kelowna Airport');
    expect(merged.browserGeolocation?.capturedAt).toBe('2026-05-08T11:00:00Z');
    expect(merged.locationPermissionAsked).toBe(true);
  });

  it('drops malformed locationOverride entries silently', () => {
    const merged = mergeWithDefaults({
      locationOverrides: [
        // valid
        {
          detectedCity: 'Kelowna',
          city: 'Kelowna',
          latitude: 49.96,
          longitude: -119.38,
        },
        // missing detectedCity
        { city: 'Bad', latitude: 1, longitude: 2 },
        // bad lat type
        { detectedCity: 'X', city: 'X', latitude: 'oops', longitude: 2 },
        // empty detectedCity
        { detectedCity: '', city: 'X', latitude: 1, longitude: 2 },
      ],
    });
    expect(merged.locationOverrides).toHaveLength(1);
    expect(merged.locationOverrides[0]?.detectedCity).toBe('Kelowna');
  });

  it('rejects malformed browserGeolocation and falls back to null', () => {
    const merged = mergeWithDefaults({
      browserGeolocation: {
        latitude: 'oops',
        longitude: -119.3,
        capturedAt: '2026-05-08T11:00:00Z',
      },
    });
    expect(merged.browserGeolocation).toBeNull();
  });

  it('accepts an explicit null browserGeolocation', () => {
    const merged = mergeWithDefaults({ browserGeolocation: null });
    expect(merged.browserGeolocation).toBeNull();
  });

  it('defaults cachedLocation to null on an absent field', () => {
    expect(mergeWithDefaults({}).cachedLocation).toBeNull();
  });

  it('accepts a well-formed cachedLocation (city may be null)', () => {
    const withCity = mergeWithDefaults({
      cachedLocation: {
        latitude: 49.888,
        longitude: -119.496,
        city: 'Kelowna',
      },
    });
    expect(withCity.cachedLocation).toEqual({
      latitude: 49.888,
      longitude: -119.496,
      city: 'Kelowna',
    });
    const nullCity = mergeWithDefaults({
      cachedLocation: { latitude: 10, longitude: 20, city: null },
    });
    expect(nullCity.cachedLocation?.city).toBeNull();
  });

  it('rejects malformed cachedLocation and falls back to null', () => {
    const merged = mergeWithDefaults({
      cachedLocation: { latitude: 'oops', longitude: -119.3, city: 'X' },
    });
    expect(merged.cachedLocation).toBeNull();
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
