import { useEffect, useMemo, useState } from 'react';
import { ECLIPSES } from '../../../shared/eclipses';
import { METEOR_SHOWERS } from '../../../shared/meteor-showers';
import {
  computeActiveEvents,
  localTomorrowYmd,
  localYmd,
  type SpecialEvent,
} from '../../../shared/special-events';

// We only need to re-evaluate when the local *day* could plausibly
// change. Polling once a minute is wildly more than enough — the
// derived YYYY-MM-DD strings only flip at midnight. Using the same
// cadence as useMoonPhase keeps the renderer's interval set small.
const RECOMPUTE_INTERVAL_MS = 60_000;

export type UseActiveEventsInput = {
  /** User latitude. null disables aurora detection. */
  latitude: number | null;
  /** Latest Kp from NOAA. null disables aurora detection. */
  kp: number | null;
  /**
   * Sticky session flag from the data snapshot. When true, the events
   * fetch failed at least once this session and the slide(s) must
   * stay hidden until the app restarts (per plan/data-sources.md).
   */
  eventsHidden: boolean;
};

/**
 * Live list of active special events derived from the bundled
 * meteor-shower + eclipse catalogs and the current location + Kp.
 * Returns an empty array when `eventsHidden` is true so the slide
 * deck collapses the events section without any further plumbing.
 *
 * Re-evaluates every minute so a midnight crossover updates the
 * today/tomorrow buckets without needing a fresh data fetch.
 */
export function useActiveEvents({
  latitude,
  kp,
  eventsHidden,
}: UseActiveEventsInput): readonly SpecialEvent[] {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (eventsHidden) return [];
    return computeActiveEvents({
      todayLocal: localYmd(now),
      tomorrowLocal: localTomorrowYmd(now),
      latitude,
      kp,
      meteorShowers: METEOR_SHOWERS,
      eclipses: ECLIPSES,
    });
  }, [now, latitude, kp, eventsHidden]);
}
