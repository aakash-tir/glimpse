import { describe, it, expect } from 'vitest';
import { formatLocalClock } from '../../src/shared/time-format';

// Per plan/slides.md § Time rendering, UTC instants render in the
// FORECAST LOCATION's zone. These pin the conversion with fixed IANA
// zones so the assertions hold regardless of the machine's own zone.
describe('formatLocalClock — explicit timezone', () => {
  // 2026-08-28T04:13:00Z is the same instant everywhere; each zone just
  // reads a different wall clock off it.
  const INSTANT = '2026-08-28T04:13:00Z';

  it('renders a UTC instant in the given zone (24h)', () => {
    expect(formatLocalClock(INSTANT, '24h', 'UTC')).toBe('04:13');
    // UTC-7 in August (PDT).
    expect(formatLocalClock(INSTANT, '24h', 'America/Los_Angeles')).toBe(
      '21:13',
    );
    // UTC+9, no DST.
    expect(formatLocalClock(INSTANT, '24h', 'Asia/Tokyo')).toBe('13:13');
    // UTC+5:30 — the half-hour offset must land on :43, not :13.
    expect(formatLocalClock(INSTANT, '24h', 'Asia/Kolkata')).toBe('09:43');
  });

  it('renders a UTC instant in the given zone (12h)', () => {
    expect(formatLocalClock(INSTANT, '12h', 'UTC')).toBe('4:13 AM');
    expect(formatLocalClock(INSTANT, '12h', 'America/Los_Angeles')).toBe(
      '9:13 PM',
    );
    expect(formatLocalClock(INSTANT, '12h', 'Asia/Tokyo')).toBe('1:13 PM');
  });

  it('renders midnight and noon with the right 12h period', () => {
    // 07:00Z is 00:00 in UTC-7 → "12:00 AM", not "0:00 AM".
    expect(
      formatLocalClock('2026-08-28T07:00:00Z', '12h', 'America/Los_Angeles'),
    ).toBe('12:00 AM');
    expect(
      formatLocalClock('2026-08-28T07:00:00Z', '24h', 'America/Los_Angeles'),
    ).toBe('00:00');
    // 19:00Z is 12:00 in UTC-7 → "12:00 PM".
    expect(
      formatLocalClock('2026-08-28T19:00:00Z', '12h', 'America/Los_Angeles'),
    ).toBe('12:00 PM');
  });

  it('honors DST — the same wall clock maps to different instants', () => {
    // January: America/Los_Angeles is UTC-8 (PST), not UTC-7.
    expect(
      formatLocalClock('2026-01-15T04:13:00Z', '24h', 'America/Los_Angeles'),
    ).toBe('20:13');
    // July: UTC-7 (PDT).
    expect(
      formatLocalClock('2026-07-15T04:13:00Z', '24h', 'America/Los_Angeles'),
    ).toBe('21:13');
  });

  it('crosses the date line correctly (zone shifts the calendar day)', () => {
    // 23:30Z on the 27th is already 08:30 on the 28th in Tokyo.
    expect(formatLocalClock('2026-08-27T23:30:00Z', '24h', 'Asia/Tokyo')).toBe(
      '08:30',
    );
  });
});

describe('formatLocalClock — fallback to host zone', () => {
  const INSTANT = '2026-08-28T04:13:00Z';

  // With no usable zone the function reads the host clock, so assert
  // against Date's own accessors rather than a hardcoded string.
  function hostClock24(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  }

  it('falls back to host local when the zone is omitted', () => {
    expect(formatLocalClock(INSTANT, '24h')).toBe(hostClock24(INSTANT));
  });

  it('falls back to host local when the zone is null', () => {
    // The real no-forecast-yet case: slide-deck passes null.
    expect(formatLocalClock(INSTANT, '24h', null)).toBe(hostClock24(INSTANT));
  });

  it('falls back to host local on an unrecognized zone instead of throwing', () => {
    // Intl throws RangeError on a bad zone; we must degrade, not crash.
    expect(formatLocalClock(INSTANT, '24h', 'Not/AZone')).toBe(
      hostClock24(INSTANT),
    );
    expect(formatLocalClock(INSTANT, '24h', '')).toBe(hostClock24(INSTANT));
  });
});

describe('formatLocalClock — invalid input', () => {
  it('returns an empty string for an unparseable date, zone or not', () => {
    expect(formatLocalClock('not-a-date', '24h')).toBe('');
    expect(formatLocalClock('not-a-date', '24h', 'Asia/Tokyo')).toBe('');
    expect(formatLocalClock('', '12h', 'UTC')).toBe('');
  });
});
