// Typed accessor for the bundled eclipse catalog.
//
// Raw JSON lives at src/data/eclipses.json (sourced from the NASA
// eclipse catalog — see plan/data-sources.md). This module exposes it
// as a typed array and validates the shape at module load so a bad
// edit fails loudly rather than silently breaking the events slide.
//
// Required fields per entry: { date (YYYY-MM-DD), type }. Optional
// enrichment fields populated on a best-effort basis for upcoming
// eclipses: peakTimeUtc (ISO instant), startTimeUtc, endTimeUtc,
// magnitude (number), visibility (static descriptive text). The slide
// renders whichever optional fields are present and gracefully omits
// the rest.

import eclipsesRaw from '../data/eclipses.json';

export type EclipseType =
  | 'total-lunar'
  | 'partial-lunar'
  | 'penumbral-lunar'
  | 'total-solar'
  | 'annular-solar'
  | 'partial-solar';

const ECLIPSE_TYPES: readonly EclipseType[] = [
  'total-lunar',
  'partial-lunar',
  'penumbral-lunar',
  'total-solar',
  'annular-solar',
  'partial-solar',
] as const;

export type Eclipse = {
  /** ISO calendar date in YYYY-MM-DD form. */
  date: string;
  type: EclipseType;
  /** UTC ISO instant of peak (greatest eclipse). */
  peakTimeUtc?: string;
  /** UTC ISO instant of partial-phase start. */
  startTimeUtc?: string;
  /** UTC ISO instant of partial-phase end. */
  endTimeUtc?: string;
  /** Magnitude (eclipse magnitude — typically 0..1 partial, ≥1 total). */
  magnitude?: number;
  /** Static visibility descriptor — e.g. "Visible from: Asia, Pacific". */
  visibility?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const parsed = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return false;
  const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
  const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = parsed.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` === s;
}

function isIsoInstant(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const parsed = Date.parse(s);
  return Number.isFinite(parsed);
}

function isEclipseType(v: unknown): v is EclipseType {
  return (
    typeof v === 'string' && (ECLIPSE_TYPES as readonly string[]).includes(v)
  );
}

function isEclipse(v: unknown): v is Eclipse {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r['date'] !== 'string' || !isRealIsoDate(r['date'])) return false;
  if (!isEclipseType(r['type'])) return false;
  if (r['peakTimeUtc'] !== undefined && !isIsoInstant(r['peakTimeUtc'])) {
    return false;
  }
  if (r['startTimeUtc'] !== undefined && !isIsoInstant(r['startTimeUtc'])) {
    return false;
  }
  if (r['endTimeUtc'] !== undefined && !isIsoInstant(r['endTimeUtc'])) {
    return false;
  }
  if (r['magnitude'] !== undefined && !Number.isFinite(r['magnitude'])) {
    return false;
  }
  if (r['visibility'] !== undefined && typeof r['visibility'] !== 'string') {
    return false;
  }
  return true;
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
    // Only carry through optional fields that were actually provided —
    // dropping `undefined` keys keeps test snapshots tight and lets the
    // slide use simple `if (eclipse.magnitude)` checks.
    const e: Eclipse = { date: entry.date, type: entry.type };
    if (entry.peakTimeUtc !== undefined) e.peakTimeUtc = entry.peakTimeUtc;
    if (entry.startTimeUtc !== undefined) e.startTimeUtc = entry.startTimeUtc;
    if (entry.endTimeUtc !== undefined) e.endTimeUtc = entry.endTimeUtc;
    if (entry.magnitude !== undefined) e.magnitude = entry.magnitude;
    if (entry.visibility !== undefined) e.visibility = entry.visibility;
    out.push(e);
  }
  return out;
}

export const ECLIPSES: readonly Eclipse[] = parseEclipses(eclipsesRaw);

/** Human-friendly title — "Total lunar eclipse", "Annular solar eclipse", etc. */
export function eclipseTypeLabel(type: EclipseType): string {
  switch (type) {
    case 'total-lunar':
      return 'Total lunar eclipse';
    case 'partial-lunar':
      return 'Partial lunar eclipse';
    case 'penumbral-lunar':
      return 'Penumbral lunar eclipse';
    case 'total-solar':
      return 'Total solar eclipse';
    case 'annular-solar':
      return 'Annular solar eclipse';
    case 'partial-solar':
      return 'Partial solar eclipse';
  }
}

/**
 * True for eclipses that produce a "blood moon" appearance — i.e. total
 * lunar eclipses where the moon passes fully through Earth's umbra and
 * reddens during totality. Drives the per-eclipse blood-moon slide.
 */
export function isBloodMoonEclipse(e: Eclipse): boolean {
  return e.type === 'total-lunar';
}
