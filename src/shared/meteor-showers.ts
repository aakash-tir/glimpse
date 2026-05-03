// Typed accessor for the bundled meteor-shower calendar.
//
// The raw JSON lives at src/data/meteor-showers.json (sourced from the
// IMO annual calendar — see plan/data-sources.md). This module exposes
// it as a typed array and validates the shape at module load so a bad
// edit fails loudly rather than silently breaking the events slide.

import meteorShowersRaw from '../data/meteor-showers.json';

export type MeteorShower = {
  name: string;
  /** ISO calendar date in YYYY-MM-DD form. */
  peakDate: string;
  /** Zenithal hourly rate at peak. */
  zhr: number;
  bestViewingTime: string;
  radiantConstellation: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  // Date.parse accepts "2026-13-99" with NaN, but also normalises
  // overflow ("2026-02-30" → 2026-03-02). Round-trip the parsed value
  // back to a YYYY-MM-DD string and require it to match the input
  // exactly so silently-normalised dates are rejected.
  const parsed = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return false;
  const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
  const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = parsed.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` === s;
}

function isMeteorShower(v: unknown): v is MeteorShower {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['name'] === 'string' &&
    typeof r['peakDate'] === 'string' &&
    isRealIsoDate(r['peakDate']) &&
    Number.isFinite(r['zhr']) &&
    typeof r['bestViewingTime'] === 'string' &&
    typeof r['radiantConstellation'] === 'string'
  );
}

export function parseMeteorShowers(raw: unknown): MeteorShower[] {
  if (!Array.isArray(raw)) {
    throw new Error('meteor-showers.json must be an array');
  }
  const out: MeteorShower[] = [];
  for (const entry of raw) {
    if (!isMeteorShower(entry)) {
      throw new Error(
        `meteor-showers.json: invalid entry ${JSON.stringify(entry)}`,
      );
    }
    out.push(entry);
  }
  return out;
}

export const METEOR_SHOWERS: readonly MeteorShower[] =
  parseMeteorShowers(meteorShowersRaw);
