// Pure helpers used by the Today (hourly) and Next 7 days slides to
// turn a Forecast snapshot into something the renderer can lay out.
//
// All times here are local-zone strings of the form "YYYY-MM-DDTHH:mm"
// (with an optional ":ss") — that is the shape Open-Meteo returns when
// `timezone=auto` is set. Treating them as opaque strings (no Date
// parsing) keeps the behavior independent of the host machine's
// timezone, which is critical: the host might be in a different zone
// from the forecast location, and SlideDeck must not show the wrong
// hour because of host-local Date arithmetic.

import type { ForecastDay, ForecastHour } from './forecast';
import type { TimeFormat } from './settings-store';

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Round `localTime` up to the next full hour and return it as a
 * "YYYY-MM-DDTHH:00" anchor string. If `localTime` is already on the
 * hour, it advances to the next hour anyway (so the hourly slide always
 * starts in the future, never on the *current* hour which is partway
 * elapsed).
 *
 * Date rollover at 23:00 → next day 00:00 is handled correctly,
 * including month / year boundaries, by parsing into UTC components,
 * adding an hour, and re-formatting.
 */
export function nextFullHourIsoLocal(localTime: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localTime);
  if (!m) {
    throw new Error(
      `nextFullHourIsoLocal: unparseable local time "${localTime}"`,
    );
  }
  const [, yyyy, mo, dd, hh] = m;
  // Build a UTC Date so adding an hour can't be derailed by the host
  // machine's local DST. The string is the location's local time, but
  // we're treating it as a pure clock-arithmetic problem — hopping
  // through Date in UTC is safe.
  const base = new Date(
    Date.UTC(Number(yyyy), Number(mo) - 1, Number(dd), Number(hh), 0, 0, 0),
  );
  base.setUTCHours(base.getUTCHours() + 1);
  const Y = String(base.getUTCFullYear()).padStart(4, '0');
  const M = String(base.getUTCMonth() + 1).padStart(2, '0');
  const D = String(base.getUTCDate()).padStart(2, '0');
  const H = String(base.getUTCHours()).padStart(2, '0');
  return `${Y}-${M}-${D}T${H}:00`;
}

/**
 * Pick the rolling N-hour window starting at the next full hour after
 * `nowLocal`. `hours` is expected to be sorted ascending by `time` (the
 * Open-Meteo response always is). If fewer than `count` hours remain
 * after the anchor, returns whatever is left — the slide layout caps
 * at `count` cells, so a short tail is handled by the caller.
 *
 * Comparison is lexical on the ISO string, which is sound because all
 * entries share the same local zone (timezone=auto in the API call)
 * and the format is fixed-width.
 */
export function selectRollingHours(
  hours: ForecastHour[],
  nowLocal: string,
  count: number,
): ForecastHour[] {
  const anchor = nextFullHourIsoLocal(nowLocal);
  const startIdx = hours.findIndex((h) => h.time >= anchor);
  if (startIdx === -1) return [];
  return hours.slice(startIdx, startIdx + count);
}

/**
 * Return true when the given hourly timestep falls inside the day's
 * sunrise → sunset window. Uses the per-day ForecastDay entry whose
 * `date` matches the hour's date prefix.
 *
 * Falls back to a sane assumption (day) when no matching daily entry
 * is found — the seven-day window covers every hour the hourly slide
 * shows, so the fallback only triggers for malformed fixtures.
 */
export function isHourDaytime(hourTime: string, daily: ForecastDay[]): boolean {
  const date = hourTime.slice(0, 10);
  const day = daily.find((d) => d.date === date);
  if (!day) return true;
  // Sunrise/sunset arrive as "YYYY-MM-DDTHH:mm" in the same zone, so
  // a lexical compare against the hour timestamp is correct.
  return hourTime >= day.sunrise && hourTime < day.sunset;
}

/**
 * Format an hourly timestep's clock time per the user's preference.
 *
 *   24h: "HH:00"            (e.g. "08:00", "23:00")
 *   12h: "h AM" / "h PM"    (e.g. "8 AM", "11 PM", "12 PM")
 *
 * Chooses minutes from the input string so a non-:00 timestep would
 * still render correctly; in practice Open-Meteo's hourly array is
 * always on the hour.
 */
export function formatHourTime(hourTime: string, format: TimeFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(hourTime);
  if (!m) return hourTime;
  const hour = Number(m[4]);
  const minute = m[5];
  if (format === '24h') {
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }
  // 12h: midnight = 12 AM, noon = 12 PM.
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === '00' ? `${h12} ${period}` : `${h12}:${minute} ${period}`;
}

/**
 * Format a daily entry's day label per plan/slides.md:
 * "Today" for the row matching `todayDate`, weekday abbreviation
 * (Sun/Mon/Tue/...) otherwise.
 *
 * `dateStr` is "YYYY-MM-DD"; `todayDate` is the local-zone today date
 * the renderer derives from the forecast's current.time.
 */
export function formatDayLabel(dateStr: string, todayDate: string): string {
  if (dateStr === todayDate) return 'Today';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  // UTC Date so the weekday calculation is timezone-independent — we
  // just need the day-of-week the calendar date resolves to.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return WEEKDAY_ABBR[d.getUTCDay()];
}

/** Extract the local-zone date prefix ("YYYY-MM-DD") from a local ISO. */
export function localDate(localTime: string): string {
  return localTime.slice(0, 10);
}
