// Shared time-format helpers. The hourly-string formatter lives in
// forecast-window.ts because it parses Open-Meteo's local-clock string
// shape; this module handles UTC ISO instants (Date.toISOString()
// output, eclipse peakTimeUtc, etc.) and renders them in the user's
// local wall clock per their 12 h / 24 h preference.

import type { TimeFormat } from './settings-store';

/**
 * Render an ISO instant as a wall-clock time in the user's local
 * timezone, formatted per the time-format preference.
 *
 *   24h:  "HH:MM"   (e.g. "08:05", "23:46")
 *   12h:  "h:MM AM/PM"   (e.g. "8:05 AM", "11:46 PM")
 *
 * Returns an empty string when the input is not a parseable date.
 */
export function formatLocalClock(iso: string, format: TimeFormat): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours24 = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (format === '24h') {
    return `${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${minutes} ${period}`;
}
