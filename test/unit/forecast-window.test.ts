import { describe, it, expect } from 'vitest';
import {
  formatDayLabel,
  formatHourTime,
  isHourDaytime,
  localDate,
  nextFullHourIsoLocal,
  selectRollingHours,
} from '../../src/shared/forecast-window';
import type { ForecastDay, ForecastHour } from '../../src/shared/forecast';

function hour(time: string): ForecastHour {
  return {
    time,
    temperature: 15,
    weatherCode: 0,
    condition: 'clear',
    precipitationProbability: 0,
  };
}

function day(date: string, sunrise: string, sunset: string): ForecastDay {
  return {
    date,
    weatherCode: 0,
    condition: 'clear',
    high: 20,
    low: 10,
    precipitationProbability: 0,
    sunrise,
    sunset,
  };
}

describe('nextFullHourIsoLocal', () => {
  it('rounds a sub-hour timestamp up to the next hour', () => {
    expect(nextFullHourIsoLocal('2026-05-03T08:23')).toBe('2026-05-03T09:00');
  });

  it('advances even when the input is exactly on the hour', () => {
    // The hourly slide must always start in the future, never on the
    // currently-elapsing hour.
    expect(nextFullHourIsoLocal('2026-05-03T08:00')).toBe('2026-05-03T09:00');
  });

  it('handles a 23:xx input by rolling the date over', () => {
    expect(nextFullHourIsoLocal('2026-05-03T23:45')).toBe('2026-05-04T00:00');
  });

  it('handles month rollover at end-of-month 23:00', () => {
    expect(nextFullHourIsoLocal('2026-05-31T23:30')).toBe('2026-06-01T00:00');
  });

  it('handles year rollover at end-of-year 23:00', () => {
    expect(nextFullHourIsoLocal('2026-12-31T23:01')).toBe('2027-01-01T00:00');
  });

  it('throws on an unparseable string rather than silently producing garbage', () => {
    expect(() => nextFullHourIsoLocal('not-a-time')).toThrow();
  });
});

describe('selectRollingHours', () => {
  // Build 10 hours starting at 06:00 to cover both the "anchor in
  // middle" and "anchor before start" branches.
  const hours = [
    hour('2026-05-03T06:00'),
    hour('2026-05-03T07:00'),
    hour('2026-05-03T08:00'),
    hour('2026-05-03T09:00'),
    hour('2026-05-03T10:00'),
    hour('2026-05-03T11:00'),
    hour('2026-05-03T12:00'),
    hour('2026-05-03T13:00'),
    hour('2026-05-03T14:00'),
    hour('2026-05-03T15:00'),
  ];

  it('starts at the next full hour after now', () => {
    const window = selectRollingHours(hours, '2026-05-03T08:23', 24);
    // 08:23 → next full hour is 09:00; first selected entry is the 09:00 hour.
    expect(window[0]?.time).toBe('2026-05-03T09:00');
  });

  it('caps the result at `count` items', () => {
    const window = selectRollingHours(hours, '2026-05-03T08:00', 3);
    // 08:00 → next full hour is 09:00; first three: 09, 10, 11.
    expect(window.map((h) => h.time)).toEqual([
      '2026-05-03T09:00',
      '2026-05-03T10:00',
      '2026-05-03T11:00',
    ]);
  });

  it('returns up to `count` even if fewer hours are available after the anchor', () => {
    const window = selectRollingHours(hours, '2026-05-03T13:30', 24);
    expect(window.map((h) => h.time)).toEqual([
      '2026-05-03T14:00',
      '2026-05-03T15:00',
    ]);
  });

  it('returns empty when the anchor is past every available hour', () => {
    const window = selectRollingHours(hours, '2026-05-03T23:30', 24);
    expect(window).toEqual([]);
  });
});

describe('isHourDaytime', () => {
  const days = [
    day('2026-05-03', '2026-05-03T06:15', '2026-05-03T20:10'),
    day('2026-05-04', '2026-05-04T06:14', '2026-05-04T20:11'),
  ];

  it('returns true for an hour squarely between sunrise and sunset', () => {
    expect(isHourDaytime('2026-05-03T12:00', days)).toBe(true);
  });

  it('returns false for an hour before sunrise', () => {
    expect(isHourDaytime('2026-05-03T05:00', days)).toBe(false);
  });

  it('returns false for an hour after sunset', () => {
    expect(isHourDaytime('2026-05-03T21:00', days)).toBe(false);
  });

  it('treats sunrise as inclusive (>= sunrise)', () => {
    expect(isHourDaytime('2026-05-03T06:15', days)).toBe(true);
  });

  it('treats sunset as exclusive (< sunset)', () => {
    expect(isHourDaytime('2026-05-03T20:10', days)).toBe(false);
  });

  it('falls back to "day" when the date has no matching daily entry', () => {
    // Only show up if the renderer is fed a malformed forecast; the
    // fallback keeps the icon picker from crashing.
    expect(isHourDaytime('2026-05-99T12:00', days)).toBe(true);
  });
});

describe('formatHourTime', () => {
  it.each([
    ['2026-05-03T00:00', '00:00'],
    ['2026-05-03T08:00', '08:00'],
    ['2026-05-03T13:00', '13:00'],
    ['2026-05-03T23:00', '23:00'],
  ])('24h: %s → %s', (input, expected) => {
    expect(formatHourTime(input, '24h')).toBe(expected);
  });

  it.each([
    ['2026-05-03T00:00', '12 AM'],
    ['2026-05-03T01:00', '1 AM'],
    ['2026-05-03T11:00', '11 AM'],
    ['2026-05-03T12:00', '12 PM'],
    ['2026-05-03T13:00', '1 PM'],
    ['2026-05-03T23:00', '11 PM'],
  ])('12h: %s → %s', (input, expected) => {
    expect(formatHourTime(input, '12h')).toBe(expected);
  });
});

describe('formatDayLabel', () => {
  it('returns "Today" for the matching date', () => {
    expect(formatDayLabel('2026-05-03', '2026-05-03')).toBe('Today');
  });

  it.each([
    // 2026-05-03 is a Sunday.
    ['2026-05-03', 'Sun'],
    ['2026-05-04', 'Mon'],
    ['2026-05-05', 'Tue'],
    ['2026-05-06', 'Wed'],
    ['2026-05-07', 'Thu'],
    ['2026-05-08', 'Fri'],
    ['2026-05-09', 'Sat'],
  ])('returns the weekday abbr for non-today dates: %s → %s', (d, expected) => {
    // Pick a "today" deliberately different so none of the dates match.
    expect(formatDayLabel(d, '2026-05-02')).toBe(expected);
  });
});

describe('localDate', () => {
  it('extracts the YYYY-MM-DD prefix from a local ISO string', () => {
    expect(localDate('2026-05-03T08:23')).toBe('2026-05-03');
  });
});
