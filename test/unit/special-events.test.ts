import { describe, it, expect } from 'vitest';
import type { Eclipse } from '../../src/shared/eclipses';
import type { MeteorShower } from '../../src/shared/meteor-showers';
import {
  computeActiveEvents,
  localTomorrowYmd,
  localYmd,
  type ComputeEventsInput,
  type SpecialEvent,
} from '../../src/shared/special-events';

const PERSEIDS: MeteorShower = {
  name: 'Perseids',
  peakDate: '2026-08-12',
  zhr: 100,
  bestViewingTime: 'Late night to pre-dawn',
  radiantConstellation: 'Perseus',
};

const GEMINIDS: MeteorShower = {
  name: 'Geminids',
  peakDate: '2026-12-14',
  zhr: 150,
  bestViewingTime: 'All night',
  radiantConstellation: 'Gemini',
};

const TOTAL_LUNAR: Eclipse = {
  date: '2028-12-31',
  type: 'total-lunar',
  peakTimeUtc: '2028-12-31T16:53:00Z',
  visibility: 'Visible from: Europe, Africa, Asia, Australia',
  magnitude: 1.25,
};

const PARTIAL_LUNAR: Eclipse = {
  date: '2026-08-28',
  type: 'partial-lunar',
  peakTimeUtc: '2026-08-28T04:13:00Z',
  visibility: 'Visible from: Americas, Pacific',
  magnitude: 0.93,
};

const TOTAL_SOLAR: Eclipse = {
  date: '2026-08-12',
  type: 'total-solar',
  peakTimeUtc: '2026-08-12T17:46:00Z',
  visibility: 'Visible from: Iceland, Greenland, Spain',
  magnitude: 1.039,
};

function baseInput(
  overrides: Partial<ComputeEventsInput> = {},
): ComputeEventsInput {
  return {
    todayLocal: '2026-05-09',
    tomorrowLocal: '2026-05-10',
    latitude: 40,
    kp: 0,
    meteorShowers: [],
    eclipses: [],
    ...overrides,
  };
}

describe('localYmd / localTomorrowYmd', () => {
  it('formats wall-clock dates in YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 9); // May 9 2026 local
    expect(localYmd(d)).toBe('2026-05-09');
    expect(localTomorrowYmd(d)).toBe('2026-05-10');
  });

  it('rolls over month and year boundaries', () => {
    expect(localTomorrowYmd(new Date(2026, 0, 31))).toBe('2026-02-01');
    expect(localTomorrowYmd(new Date(2026, 11, 31))).toBe('2027-01-01');
    // Leap day: 2024 was a leap year.
    expect(localTomorrowYmd(new Date(2024, 1, 28))).toBe('2024-02-29');
    expect(localTomorrowYmd(new Date(2024, 1, 29))).toBe('2024-03-01');
  });
});

describe('computeActiveEvents — detection', () => {
  it('returns nothing when no events overlap today or tomorrow', () => {
    const out = computeActiveEvents(
      baseInput({ meteorShowers: [PERSEIDS], eclipses: [TOTAL_LUNAR] }),
    );
    expect(out).toEqual([]);
  });

  it('detects a meteor shower whose peak is today', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-12',
        tomorrowLocal: '2026-08-13',
        meteorShowers: [PERSEIDS],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('meteor');
    expect(out[0]!.dayOffset).toBe(0);
  });

  it('detects a meteor shower whose peak is tomorrow', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-11',
        tomorrowLocal: '2026-08-12',
        meteorShowers: [PERSEIDS],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.dayOffset).toBe(1);
  });

  it('detects a partial lunar eclipse without generating a blood moon', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-28',
        tomorrowLocal: '2026-08-29',
        eclipses: [PARTIAL_LUNAR],
      }),
    );
    expect(out.map((e) => e.type)).toEqual(['eclipse']);
  });

  it('generates only a blood moon (not an eclipse) for total lunar eclipses', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2028-12-31',
        tomorrowLocal: '2029-01-01',
        eclipses: [TOTAL_LUNAR],
      }),
    );
    expect(out.map((e) => e.type)).toEqual(['blood-moon']);
  });

  it('does not detect aurora when latitude or kp is missing', () => {
    expect(computeActiveEvents(baseInput({ latitude: null, kp: 9 }))).toEqual(
      [],
    );
    expect(computeActiveEvents(baseInput({ latitude: 60, kp: null }))).toEqual(
      [],
    );
  });

  it('detects aurora when (lat, kp) crosses the threshold', () => {
    // ≥60° latitude → Kp ≥ 4
    const out = computeActiveEvents(baseInput({ latitude: 65, kp: 5 }));
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('aurora');
    expect(out[0]!.dayOffset).toBe(0);
    if (out[0]!.type === 'aurora') {
      expect(out[0]!.visibilityText).toBe('Visible from your location');
    }
  });

  it('does not detect aurora below threshold (Visible-at-N text path)', () => {
    // 45° → threshold Kp ≥ 6; Kp = 4 means visible only at ≥60°.
    const out = computeActiveEvents(baseInput({ latitude: 45, kp: 4 }));
    expect(out).toEqual([]);
  });

  it('full moon is never a special event (no full-moon entries are produced)', () => {
    // Even when the meteor list is empty and a total lunar eclipse
    // is present, only a blood-moon is generated — never a bare
    // "full moon" event. Sanity check on the contract.
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2028-12-31',
        tomorrowLocal: '2029-01-01',
        eclipses: [TOTAL_LUNAR],
      }),
    );
    for (const e of out) {
      expect(e.type).not.toBe('full-moon' as never);
    }
  });
});

describe('computeActiveEvents — ordering', () => {
  it('today events come before tomorrow events', () => {
    // Aurora today (lat 65, Kp 5) + meteor shower tomorrow.
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-11',
        tomorrowLocal: '2026-08-12',
        latitude: 65,
        kp: 5,
        meteorShowers: [PERSEIDS],
      }),
    );
    expect(out.map((e) => ({ type: e.type, day: e.dayOffset }))).toEqual([
      { type: 'aurora', day: 0 },
      { type: 'meteor', day: 1 },
    ]);
  });

  it('within a day, alphabetical by event type', () => {
    // Same day: total solar eclipse + Perseids meteor shower (both 2026-08-12).
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-12',
        tomorrowLocal: '2026-08-13',
        meteorShowers: [PERSEIDS],
        eclipses: [TOTAL_SOLAR],
      }),
    );
    expect(out.map((e) => e.type)).toEqual(['eclipse', 'meteor']);
  });

  it('blood-moon sorts before meteor on the same day (alphabetical by type)', () => {
    // A total lunar eclipse (→ blood-moon) and a meteor shower peaking
    // the same night: TYPE_ORDER puts blood-moon (1) before meteor (3).
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2028-12-31',
        tomorrowLocal: '2029-01-01',
        eclipses: [TOTAL_LUNAR],
        meteorShowers: [{ ...PERSEIDS, peakDate: '2028-12-31' }],
      }),
    );
    expect(out.map((e) => e.type)).toEqual(['blood-moon', 'meteor']);
  });

  it('aurora (today) sorts ahead of any tomorrow event of any type', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2028-12-30',
        tomorrowLocal: '2028-12-31',
        latitude: 65,
        kp: 5,
        eclipses: [TOTAL_LUNAR],
      }),
    );
    // Aurora today, then the total-lunar's blood moon tomorrow.
    expect(out.map((e) => ({ type: e.type, day: e.dayOffset }))).toEqual([
      { type: 'aurora', day: 0 },
      { type: 'blood-moon', day: 1 },
    ]);
  });

  it('multiple meteor showers (theoretical) preserve source order via stable sort', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2026-08-12',
        tomorrowLocal: '2026-08-13',
        meteorShowers: [PERSEIDS, GEMINIDS],
      }),
    );
    // Only Perseids matches today; Geminids is December.
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('meteor');
    if (out[0]!.type === 'meteor') {
      expect(out[0]!.shower.name).toBe('Perseids');
    }
  });
});

describe('computeActiveEvents — slide ids', () => {
  it('produces unique stable ids per event for the slide deck', () => {
    const out = computeActiveEvents(
      baseInput({
        todayLocal: '2028-12-31',
        tomorrowLocal: '2029-01-01',
        latitude: 65,
        kp: 5,
        // Total lunar today → blood-moon id; a solar eclipse tomorrow
        // → eclipse id. Together with aurora that's all three id forms.
        eclipses: [TOTAL_LUNAR, { date: '2029-01-01', type: 'total-solar' }],
      }),
    );
    const ids = out.map((e: SpecialEvent) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('event:aurora');
    expect(ids).toContain('event:blood-moon:2028-12-31');
    expect(ids).toContain('event:eclipse:2029-01-01');
  });
});
