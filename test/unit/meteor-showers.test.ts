import { describe, it, expect } from 'vitest';
import {
  METEOR_SHOWERS,
  parseMeteorShowers,
} from '../../src/shared/meteor-showers';

describe('METEOR_SHOWERS (bundled JSON)', () => {
  it('contains the major IMO showers (Quadrantids, Perseids, Geminids)', () => {
    const names = METEOR_SHOWERS.map((s) => s.name);
    expect(names).toContain('Quadrantids');
    expect(names).toContain('Perseids');
    expect(names).toContain('Geminids');
  });

  it('every entry has a valid YYYY-MM-DD peakDate that parses to a real date', () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.peakDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(s.peakDate + 'T00:00:00Z');
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    }
  });

  it('every entry has a positive ZHR', () => {
    for (const s of METEOR_SHOWERS) {
      expect(s.zhr).toBeGreaterThan(0);
    }
  });
});

describe('parseMeteorShowers', () => {
  it('throws on non-array input', () => {
    expect(() => parseMeteorShowers(null)).toThrow();
    expect(() => parseMeteorShowers({})).toThrow();
    expect(() => parseMeteorShowers('nope')).toThrow();
  });

  it('throws on entries with missing or wrong-shape fields', () => {
    expect(() =>
      parseMeteorShowers([
        {
          name: 'Bad',
          peakDate: '2026-13-99',
          zhr: 1,
          bestViewingTime: '',
          radiantConstellation: '',
        },
      ]),
    ).toThrow();
    expect(() =>
      parseMeteorShowers([
        {
          name: 'Bad',
          peakDate: '2026-01-01',
          zhr: 'a-lot',
          bestViewingTime: '',
          radiantConstellation: '',
        },
      ]),
    ).toThrow();
  });

  it('returns a typed copy when the input is well-formed', () => {
    const out = parseMeteorShowers([
      {
        name: 'Test',
        peakDate: '2026-08-12',
        zhr: 100,
        bestViewingTime: 'Late night',
        radiantConstellation: 'Perseus',
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('Test');
    expect(out[0]!.zhr).toBe(100);
  });
});
