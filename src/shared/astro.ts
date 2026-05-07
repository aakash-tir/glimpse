// Local astronomical helpers built on top of SunCalc.
//
// Exposes two things consumed by the data store:
//   - moonPhase(date) — discrete phase name + illumination fraction,
//     used by the moon-phase slide (M7).
//   - eclipseOnDate / nextEclipseFromDate — used by the events filter
//     (M5) and the eclipse / blood-moon slides (M8).
//
// SunCalc itself does not compute eclipses. Instead a static NASA-
// catalog list lives at src/data/eclipses.json and is consulted here.
// Same yearly-lag tradeoff documented for meteor showers in
// plan/data-sources.md — major eclipse dates are well known years out.

import SunCalc from 'suncalc';

import eclipsesRaw from '../data/eclipses.json';

export type MoonPhaseName =
  | 'new-moon'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full-moon'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export type MoonPhase = {
  /** SunCalc raw phase value, 0..1. */
  phase: number;
  /** Illuminated fraction of the disk, 0..1. */
  illumination: number;
  /** Discrete phase name for display. */
  name: MoonPhaseName;
};

// Discrete phase classification. SunCalc's phase value:
//   0    = new moon
//   0.25 = first quarter
//   0.5  = full moon
//   0.75 = last quarter
// The named phases occupy 1/8 wide bands centred on each cardinal
// value, so e.g. "new" is phase < 0.0625 OR phase ≥ 0.9375.
export function classifyMoonPhase(phase: number): MoonPhaseName {
  // Normalise into [0, 1).
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0625 || p >= 0.9375) return 'new-moon';
  if (p < 0.1875) return 'waxing-crescent';
  if (p < 0.3125) return 'first-quarter';
  if (p < 0.4375) return 'waxing-gibbous';
  if (p < 0.5625) return 'full-moon';
  if (p < 0.6875) return 'waning-gibbous';
  if (p < 0.8125) return 'last-quarter';
  return 'waning-crescent';
}

export function moonPhase(date: Date): MoonPhase {
  const m = SunCalc.getMoonIllumination(date);
  return {
    phase: m.phase,
    illumination: m.fraction,
    name: classifyMoonPhase(m.phase),
  };
}

export type EclipseType =
  | 'total-lunar'
  | 'partial-lunar'
  | 'penumbral-lunar'
  | 'total-solar'
  | 'annular-solar'
  | 'partial-solar';

export type Eclipse = {
  /** YYYY-MM-DD UTC date of the eclipse maximum. */
  date: string;
  type: EclipseType;
};

const ECLIPSE_TYPES: ReadonlySet<string> = new Set([
  'total-lunar',
  'partial-lunar',
  'penumbral-lunar',
  'total-solar',
  'annular-solar',
  'partial-solar',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isEclipse(v: unknown): v is Eclipse {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['date'] === 'string' &&
    ISO_DATE.test(r['date']) &&
    typeof r['type'] === 'string' &&
    ECLIPSE_TYPES.has(r['type'])
  );
}

export function parseEclipses(raw: unknown): Eclipse[] {
  if (!Array.isArray(raw)) {
    throw new Error('eclipses.json must be an array');
  }
  const out: Eclipse[] = [];
  for (const entry of raw) {
    if (!isEclipse(entry)) {
      throw new Error(`eclipses.json: invalid entry ${JSON.stringify(entry)}`);
    }
    out.push(entry);
  }
  // Sorted ascending by date so nextEclipseFromDate can scan once.
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export const ECLIPSES: readonly Eclipse[] = parseEclipses(eclipsesRaw);

function dateToUtcIso(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function eclipseOnDate(date: Date): Eclipse | null {
  const iso = dateToUtcIso(date);
  return ECLIPSES.find((e) => e.date === iso) ?? null;
}

export function nextEclipseFromDate(date: Date): Eclipse | null {
  const iso = dateToUtcIso(date);
  return ECLIPSES.find((e) => e.date >= iso) ?? null;
}
