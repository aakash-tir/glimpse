import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  findActiveOverride,
  removeLocationOverride,
  upsertLocationOverride,
  type LocationOverride,
  type Settings,
} from '../../src/shared/settings-store';
import { resolveCoords } from '../../src/shared/location-resolver';

const DETECTED_KELOWNA = {
  latitude: 50.0528,
  longitude: -119.2858,
  city: 'Kelowna',
};

const KELOWNA_OVERRIDE: LocationOverride = {
  detectedCity: 'Kelowna',
  city: 'Kelowna Airport',
  latitude: 49.9569,
  longitude: -119.3779,
};

function settings(overrides?: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('findActiveOverride', () => {
  it('returns null when advancedLocationEnabled is false (overrides dormant)', () => {
    const s = settings({
      advancedLocationEnabled: false,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    expect(findActiveOverride(s, 'Kelowna')).toBeNull();
  });

  it('returns the matching entry when enabled and city matches', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    expect(findActiveOverride(s, 'Kelowna')).toBe(KELOWNA_OVERRIDE);
  });

  it('returns null when enabled but no entry matches the detected city', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    expect(findActiveOverride(s, 'Vancouver')).toBeNull();
  });

  it('matches case-insensitively (IP providers disagree on case)', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    expect(findActiveOverride(s, 'kelowna')).toBe(KELOWNA_OVERRIDE);
    expect(findActiveOverride(s, 'KELOWNA')).toBe(KELOWNA_OVERRIDE);
  });

  it('returns null when detected city is null', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    expect(findActiveOverride(s, null)).toBeNull();
  });
});

describe('upsertLocationOverride', () => {
  it('appends a new entry when no matching detectedCity exists', () => {
    const result = upsertLocationOverride([], KELOWNA_OVERRIDE);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(KELOWNA_OVERRIDE);
  });

  it('replaces an existing entry for the same detectedCity', () => {
    const existing: LocationOverride[] = [KELOWNA_OVERRIDE];
    const next: LocationOverride = {
      ...KELOWNA_OVERRIDE,
      latitude: 49.96,
      longitude: -119.38,
      city: 'Updated Kelowna',
    };
    const result = upsertLocationOverride(existing, next);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(next);
  });

  it('replaces case-insensitively', () => {
    const existing: LocationOverride[] = [KELOWNA_OVERRIDE];
    const next: LocationOverride = {
      ...KELOWNA_OVERRIDE,
      detectedCity: 'kelowna',
      city: 'Lowercase',
    };
    const result = upsertLocationOverride(existing, next);
    expect(result).toHaveLength(1);
    expect(result[0]?.city).toBe('Lowercase');
  });

  it('preserves entries for other detectedCities', () => {
    const vancouver: LocationOverride = {
      detectedCity: 'Vancouver',
      city: 'Vancouver',
      latitude: 49.28,
      longitude: -123.12,
    };
    const result = upsertLocationOverride([vancouver], KELOWNA_OVERRIDE);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.detectedCity).sort()).toEqual([
      'Kelowna',
      'Vancouver',
    ]);
  });

  it('does not mutate the input array', () => {
    const existing: LocationOverride[] = [KELOWNA_OVERRIDE];
    upsertLocationOverride(existing, {
      ...KELOWNA_OVERRIDE,
      city: 'Mutated',
    });
    expect(existing[0]?.city).toBe('Kelowna Airport');
  });
});

describe('removeLocationOverride', () => {
  it('removes the entry for a given detectedCity', () => {
    const result = removeLocationOverride([KELOWNA_OVERRIDE], 'Kelowna');
    expect(result).toHaveLength(0);
  });

  it('matches case-insensitively', () => {
    const result = removeLocationOverride([KELOWNA_OVERRIDE], 'KELOWNA');
    expect(result).toHaveLength(0);
  });

  it('preserves non-matching entries', () => {
    const vancouver: LocationOverride = {
      detectedCity: 'Vancouver',
      city: 'Vancouver',
      latitude: 49.28,
      longitude: -123.12,
    };
    const result = removeLocationOverride(
      [KELOWNA_OVERRIDE, vancouver],
      'Kelowna',
    );
    expect(result).toEqual([vancouver]);
  });
});

describe('resolveCoords priority', () => {
  it('falls back to IP-detected coords when nothing else is configured', () => {
    const r = resolveCoords(DETECTED_KELOWNA, settings());
    expect(r.source).toBe('ip');
    expect(r.latitude).toBe(DETECTED_KELOWNA.latitude);
    expect(r.longitude).toBe(DETECTED_KELOWNA.longitude);
    expect(r.displayCity).toBe('Kelowna');
  });

  it('uses cached browser geolocation when no override matches', () => {
    const s = settings({
      browserGeolocation: {
        latitude: 49.95,
        longitude: -119.4,
        capturedAt: '2026-05-08T11:00:00Z',
      },
    });
    const r = resolveCoords(DETECTED_KELOWNA, s);
    expect(r.source).toBe('browser');
    expect(r.latitude).toBe(49.95);
    expect(r.longitude).toBe(-119.4);
    // Browser geo has no city of its own — falls back to IP city for display.
    expect(r.displayCity).toBe('Kelowna');
  });

  it('uses an active override over browser geolocation', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
      browserGeolocation: {
        latitude: 49.95,
        longitude: -119.4,
        capturedAt: '2026-05-08T11:00:00Z',
      },
    });
    const r = resolveCoords(DETECTED_KELOWNA, s);
    expect(r.source).toBe('override');
    expect(r.latitude).toBe(KELOWNA_OVERRIDE.latitude);
    expect(r.longitude).toBe(KELOWNA_OVERRIDE.longitude);
    expect(r.displayCity).toBe(KELOWNA_OVERRIDE.city);
  });

  it('keeps an override dormant when advancedLocationEnabled is false', () => {
    const s = settings({
      advancedLocationEnabled: false,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    const r = resolveCoords(DETECTED_KELOWNA, s);
    // Override is dormant → falls through to IP (no browser geo set).
    expect(r.source).toBe('ip');
  });

  it('reactivates the override when the user travels back to a matching city', () => {
    const s = settings({
      advancedLocationEnabled: true,
      locationOverrides: [KELOWNA_OVERRIDE],
    });
    // Travel away — IP says Vancouver, no Vancouver override → use IP.
    const away = resolveCoords(
      { latitude: 49.28, longitude: -123.12, city: 'Vancouver' },
      s,
    );
    expect(away.source).toBe('ip');
    expect(away.displayCity).toBe('Vancouver');

    // Travel back — IP says Kelowna again → Kelowna override reactivates.
    const back = resolveCoords(DETECTED_KELOWNA, s);
    expect(back.source).toBe('override');
    expect(back.displayCity).toBe(KELOWNA_OVERRIDE.city);
  });
});
