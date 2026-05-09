import { describe, it, expect } from 'vitest';
import {
  ECLIPSES,
  eclipseTypeLabel,
  isBloodMoonEclipse,
  parseEclipses,
  type Eclipse,
} from '../../src/shared/eclipses';

describe('ECLIPSES (bundled JSON)', () => {
  it('contains a few well-known upcoming eclipses', () => {
    const dates = ECLIPSES.map((e) => e.date);
    expect(dates).toContain('2026-08-12'); // total solar
    expect(dates).toContain('2026-08-28'); // partial lunar
    expect(dates).toContain('2028-12-31'); // total lunar (blood moon)
  });

  it('every entry has a valid YYYY-MM-DD date that parses to a real date', () => {
    for (const e of ECLIPSES) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(e.date + 'T00:00:00Z');
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    }
  });

  it('every entry has a known type', () => {
    const allowed = new Set([
      'total-lunar',
      'partial-lunar',
      'penumbral-lunar',
      'total-solar',
      'annular-solar',
      'partial-solar',
    ]);
    for (const e of ECLIPSES) {
      expect(allowed.has(e.type)).toBe(true);
    }
  });
});

describe('parseEclipses', () => {
  it('throws on non-array input', () => {
    expect(() => parseEclipses(null)).toThrow();
    expect(() => parseEclipses({})).toThrow();
    expect(() => parseEclipses('nope')).toThrow();
  });

  it('throws on a normalised-but-invalid date', () => {
    expect(() =>
      parseEclipses([{ date: '2026-02-30', type: 'total-lunar' }]),
    ).toThrow();
  });

  it('throws on an unknown type', () => {
    expect(() =>
      parseEclipses([{ date: '2026-08-12', type: 'super-eclipse' }]),
    ).toThrow();
  });

  it('throws when peakTimeUtc is not a parseable instant', () => {
    expect(() =>
      parseEclipses([
        { date: '2026-08-12', type: 'total-solar', peakTimeUtc: 'noon' },
      ]),
    ).toThrow();
  });

  it('throws when magnitude is not finite', () => {
    expect(() =>
      parseEclipses([
        { date: '2026-08-12', type: 'total-solar', magnitude: 'big' },
      ]),
    ).toThrow();
  });

  it('throws when visibility is not a string', () => {
    expect(() =>
      parseEclipses([
        { date: '2026-08-12', type: 'total-solar', visibility: 123 },
      ]),
    ).toThrow();
  });

  it('returns a typed copy with optional fields preserved when present', () => {
    const out = parseEclipses([
      {
        date: '2026-08-28',
        type: 'partial-lunar',
        peakTimeUtc: '2026-08-28T04:13:00Z',
        magnitude: 0.93,
        visibility: 'Visible from: Americas, Pacific',
      },
    ]);
    expect(out).toHaveLength(1);
    const e = out[0] as Eclipse;
    expect(e.date).toBe('2026-08-28');
    expect(e.type).toBe('partial-lunar');
    expect(e.peakTimeUtc).toBe('2026-08-28T04:13:00Z');
    expect(e.magnitude).toBe(0.93);
    expect(e.visibility).toBe('Visible from: Americas, Pacific');
  });

  it('omits absent optional fields from the parsed entry (no `undefined` keys)', () => {
    const out = parseEclipses([
      { date: '2026-02-17', type: 'annular-solar' },
    ]);
    expect(out).toHaveLength(1);
    const keys = Object.keys(out[0]!);
    expect(keys.sort()).toEqual(['date', 'type']);
  });
});

describe('eclipseTypeLabel', () => {
  it('renders human-readable titles for every type', () => {
    expect(eclipseTypeLabel('total-lunar')).toBe('Total lunar eclipse');
    expect(eclipseTypeLabel('partial-lunar')).toBe('Partial lunar eclipse');
    expect(eclipseTypeLabel('penumbral-lunar')).toBe(
      'Penumbral lunar eclipse',
    );
    expect(eclipseTypeLabel('total-solar')).toBe('Total solar eclipse');
    expect(eclipseTypeLabel('annular-solar')).toBe('Annular solar eclipse');
    expect(eclipseTypeLabel('partial-solar')).toBe('Partial solar eclipse');
  });
});

describe('isBloodMoonEclipse', () => {
  it('is true only for total lunar eclipses', () => {
    expect(
      isBloodMoonEclipse({ date: '2028-12-31', type: 'total-lunar' }),
    ).toBe(true);
    expect(
      isBloodMoonEclipse({ date: '2026-08-28', type: 'partial-lunar' }),
    ).toBe(false);
    expect(
      isBloodMoonEclipse({ date: '2026-08-12', type: 'total-solar' }),
    ).toBe(false);
    expect(
      isBloodMoonEclipse({ date: '2027-02-20', type: 'penumbral-lunar' }),
    ).toBe(false);
  });
});
