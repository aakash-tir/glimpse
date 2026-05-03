import { describe, it, expect } from 'vitest';
import {
  classifyMoonPhase,
  ECLIPSES,
  eclipseOnDate,
  moonPhase,
  nextEclipseFromDate,
  parseEclipses,
} from '../../src/shared/astro';

// Known full / new moons used to sanity-check the SunCalc wrapper.
// Dates are UTC, taken from NASA / timeanddate.com almanac entries.
// The exact phase moment occurs at a specific time of day; sampling
// at noon UTC gives illumination near the extreme without depending
// on a precise instant.
type LunarRow = {
  iso: string;
  expectedName: 'new-moon' | 'full-moon';
  // Tolerance for illumination: full moon ≈ 1.0, new moon ≈ 0.0.
  // Within ±0.05 is well inside the 1/8-band classification width
  // and far enough from the cardinal that day-of-week shifts don't
  // flip the answer.
  illuminationNear: number;
};

const lunarCases: LunarRow[] = [
  {
    iso: '2024-01-25T12:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
  {
    iso: '2024-08-19T12:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
  {
    iso: '2024-09-03T12:00:00Z',
    expectedName: 'new-moon',
    illuminationNear: 0,
  },
  {
    iso: '2025-03-14T06:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
  {
    iso: '2025-09-07T18:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
  {
    iso: '2026-03-03T12:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
  {
    iso: '2026-05-31T12:00:00Z',
    expectedName: 'full-moon',
    illuminationNear: 1,
  },
];

describe('classifyMoonPhase — discrete phase bands', () => {
  it('cardinal phase values land on their named band', () => {
    expect(classifyMoonPhase(0)).toBe('new-moon');
    expect(classifyMoonPhase(0.25)).toBe('first-quarter');
    expect(classifyMoonPhase(0.5)).toBe('full-moon');
    expect(classifyMoonPhase(0.75)).toBe('last-quarter');
  });

  it('intermediate values fall into the right gibbous / crescent band', () => {
    expect(classifyMoonPhase(0.125)).toBe('waxing-crescent');
    expect(classifyMoonPhase(0.375)).toBe('waxing-gibbous');
    expect(classifyMoonPhase(0.625)).toBe('waning-gibbous');
    expect(classifyMoonPhase(0.875)).toBe('waning-crescent');
  });

  it('wraps modulo 1 (handles SunCalc edge values like 0.99 or -0.01)', () => {
    expect(classifyMoonPhase(0.99)).toBe('new-moon');
    expect(classifyMoonPhase(-0.01)).toBe('new-moon');
    expect(classifyMoonPhase(1.5)).toBe('full-moon');
  });
});

describe('moonPhase — known full / new moons in 2024-2026', () => {
  for (const row of lunarCases) {
    it(`${row.iso} → ${row.expectedName}`, () => {
      const result = moonPhase(new Date(row.iso));
      expect(result.name).toBe(row.expectedName);
      expect(result.illumination).toBeCloseTo(row.illuminationNear, 1);
    });
  }
});

describe('ECLIPSES (bundled JSON)', () => {
  it('contains the well-known recent eclipses', () => {
    const dates = ECLIPSES.map((e) => e.date);
    expect(dates).toContain('2024-04-08'); // Total solar (NA path)
    expect(dates).toContain('2025-03-14'); // Total lunar
    expect(dates).toContain('2026-03-03'); // Total lunar
    expect(dates).toContain('2026-08-12'); // Total solar
  });

  it('is sorted ascending by date', () => {
    const dates = ECLIPSES.map((e) => e.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});

describe('eclipseOnDate / nextEclipseFromDate', () => {
  it('eclipseOnDate returns the entry when the UTC date matches', () => {
    const e = eclipseOnDate(new Date('2026-03-03T00:00:00Z'));
    expect(e).not.toBeNull();
    expect(e?.type).toBe('total-lunar');
  });

  it('eclipseOnDate returns null for a non-eclipse day', () => {
    expect(eclipseOnDate(new Date('2026-03-04T00:00:00Z'))).toBeNull();
  });

  it('nextEclipseFromDate returns today if today IS an eclipse', () => {
    const e = nextEclipseFromDate(new Date('2026-03-03T00:00:00Z'));
    expect(e?.date).toBe('2026-03-03');
  });

  it('nextEclipseFromDate skips past dates and returns the next future one', () => {
    const e = nextEclipseFromDate(new Date('2026-03-04T00:00:00Z'));
    expect(e?.date).toBe('2026-08-12');
  });

  it('nextEclipseFromDate returns null when nothing left in the table', () => {
    expect(nextEclipseFromDate(new Date('2030-01-01T00:00:00Z'))).toBeNull();
  });
});

describe('parseEclipses', () => {
  it('throws on non-array input', () => {
    expect(() => parseEclipses(null)).toThrow();
    expect(() => parseEclipses({})).toThrow();
  });

  it('rejects unknown eclipse types', () => {
    expect(() =>
      parseEclipses([{ date: '2026-01-01', type: 'glow-up' }]),
    ).toThrow();
  });

  it('rejects malformed dates', () => {
    expect(() =>
      parseEclipses([{ date: 'tomorrow', type: 'total-lunar' }]),
    ).toThrow();
  });

  it('sorts ascending by date even if input is unsorted', () => {
    const out = parseEclipses([
      { date: '2027-01-01', type: 'total-lunar' },
      { date: '2026-01-01', type: 'total-solar' },
    ]);
    expect(out.map((e) => e.date)).toEqual(['2026-01-01', '2027-01-01']);
  });
});
