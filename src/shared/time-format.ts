// Shared time-format helpers. The hourly-string formatter lives in
// forecast-window.ts because it parses Open-Meteo's local-clock string
// shape (already in the forecast location's zone); this module handles
// UTC ISO instants (Date.toISOString() output, eclipse peakTimeUtc,
// etc.) and renders them per the user's 12 h / 24 h preference.
//
// Per plan/slides.md § Time rendering, these render in the FORECAST
// LOCATION's timezone, not the host's — otherwise a user with a
// location override reads an eclipse peak in their own zone right next
// to hourly times in the target city's zone, silently off by the
// offset between them. Callers pass Forecast.timezone; when no forecast
// has loaded there is no zone to use and we fall back to host-local.

import type { TimeFormat } from './settings-store';

/** Hour (0–23) and minute of `d` as read in `timeZone`, or null if
 * the zone is unusable (unknown IANA name, no Intl data). */
function partsInZone(
  d: Date,
  timeZone: string,
): { hours24: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      // h23 so the hour part is a plain 00–23 with no day-period.
      hourCycle: 'h23',
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (hour === undefined || minute === undefined) return null;
    const hours24 = Number(hour);
    const minutes = Number(minute);
    if (!Number.isFinite(hours24) || !Number.isFinite(minutes)) return null;
    return { hours24, minutes };
  } catch {
    // Intl throws RangeError on an unrecognized timeZone.
    return null;
  }
}

/**
 * Render an ISO instant as a wall-clock time, formatted per the
 * time-format preference.
 *
 *   24h:  "HH:MM"   (e.g. "08:05", "23:46")
 *   12h:  "h:MM AM/PM"   (e.g. "8:05 AM", "11:46 PM")
 *
 * `timeZone` is an IANA name (Forecast.timezone). When omitted, null,
 * or unrecognized, the host's local zone is used instead.
 *
 * Returns an empty string when the input is not a parseable date.
 */
export function formatLocalClock(
  iso: string,
  format: TimeFormat,
  timeZone?: string | null,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const zoned = timeZone ? partsInZone(d, timeZone) : null;
  const hours24 = zoned ? zoned.hours24 : d.getHours();
  const minutes = String(zoned ? zoned.minutes : d.getMinutes()).padStart(
    2,
    '0',
  );
  if (format === '24h') {
    return `${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${minutes} ${period}`;
}
