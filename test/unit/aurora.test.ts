import { describe, it, expect } from 'vitest';
import {
  evaluateAuroraVisibility,
  thresholdForLatitude,
} from '../../src/shared/aurora';

// One row per (latitude, kp) combination from the spec table, plus a
// few off-table cases. visible = whether the slide-visibility filter
// should report this location can see the aurora locally.
type Row = { lat: number; kp: number; visible: boolean };

const rows: Row[] = [
  // ≥ 60°: threshold Kp 4
  { lat: 65, kp: 3, visible: false },
  { lat: 65, kp: 4, visible: true },
  { lat: 60, kp: 4, visible: true },
  { lat: 60, kp: 9, visible: true },

  // 50° – 60°: threshold Kp 5
  { lat: 55, kp: 4, visible: false },
  { lat: 55, kp: 5, visible: true },
  { lat: 50, kp: 5, visible: true },

  // 40° – 50°: threshold Kp 6
  { lat: 45, kp: 5, visible: false },
  { lat: 45, kp: 6, visible: true },
  { lat: 40, kp: 6, visible: true },

  // < 40°: threshold Kp 7
  { lat: 35, kp: 6, visible: false },
  { lat: 35, kp: 7, visible: true },
  { lat: 0, kp: 7, visible: true },
  { lat: 0, kp: 6, visible: false },
];

describe('thresholdForLatitude', () => {
  it('returns the per-band threshold (≥60 / 50–60 / 40–50 / <40)', () => {
    expect(thresholdForLatitude(80)).toBe(4);
    expect(thresholdForLatitude(60)).toBe(4);
    expect(thresholdForLatitude(59)).toBe(5);
    expect(thresholdForLatitude(50)).toBe(5);
    expect(thresholdForLatitude(49)).toBe(6);
    expect(thresholdForLatitude(40)).toBe(6);
    expect(thresholdForLatitude(39)).toBe(7);
    expect(thresholdForLatitude(0)).toBe(7);
  });
});

describe('evaluateAuroraVisibility — slide visibility filter', () => {
  for (const row of rows) {
    it(`lat=${row.lat}° kp=${row.kp} → ${row.visible ? 'visible' : 'hidden'}`, () => {
      const result = evaluateAuroraVisibility({
        latitude: row.lat,
        kp: row.kp,
      });
      expect(result.visibleFromUserLocation).toBe(row.visible);
    });
  }

  it('treats southern-hemisphere latitudes by absolute value', () => {
    // Lat -65° (Antarctica-adjacent) should behave like +65°.
    expect(
      evaluateAuroraVisibility({ latitude: -65, kp: 4 })
        .visibleFromUserLocation,
    ).toBe(true);
    expect(
      evaluateAuroraVisibility({ latitude: -45, kp: 5 })
        .visibleFromUserLocation,
    ).toBe(false);
  });
});

describe('evaluateAuroraVisibility — text', () => {
  it('says "Visible from your location" when the user threshold is met', () => {
    expect(evaluateAuroraVisibility({ latitude: 65, kp: 4 }).text).toBe(
      'Visible from your location',
    );
    expect(evaluateAuroraVisibility({ latitude: 35, kp: 7 }).text).toBe(
      'Visible from your location',
    );
  });

  it('points to the lowest band when the user threshold is not met', () => {
    // User at lat 35° (band <40°, threshold 7). Kp = 6 → visible at
    // latitudes ≥ 40°.
    expect(evaluateAuroraVisibility({ latitude: 35, kp: 6 }).text).toBe(
      'Visible at latitudes ≥ 40°',
    );
    // User at lat 45° (band 40–50, threshold 6). Kp = 5 → visible at
    // latitudes ≥ 50°.
    expect(evaluateAuroraVisibility({ latitude: 45, kp: 5 }).text).toBe(
      'Visible at latitudes ≥ 50°',
    );
    // User at lat 55° (band 50–60, threshold 5). Kp = 4 → visible at
    // latitudes ≥ 60°.
    expect(evaluateAuroraVisibility({ latitude: 55, kp: 4 }).text).toBe(
      'Visible at latitudes ≥ 60°',
    );
  });

  it('falls back to "Not currently visible" when Kp is below every band', () => {
    expect(evaluateAuroraVisibility({ latitude: 35, kp: 2 }).text).toBe(
      'Not currently visible',
    );
  });
});
