import { useEffect, useState } from 'react';
import { moonPhase, type MoonPhase } from '../../../shared/astro';

// The moon phase changes by ~1.3% per hour, so recomputing once a
// minute is way more than enough resolution for the slide. We avoid
// running on every render so the SVG path doesn't churn — phase is
// stable for many minutes at a time.
const RECOMPUTE_INTERVAL_MS = 60_000;

/**
 * Live moon-phase reading derived from `new Date()`. Returns null only
 * during the synchronous initial render before useEffect fires, so the
 * MoonSlide can show its loading skeleton briefly. In practice the
 * effect runs immediately after mount, so the null window is one
 * frame.
 */
export function useMoonPhase(): MoonPhase | null {
  const [phase, setPhase] = useState<MoonPhase | null>(null);

  useEffect(() => {
    const update = (): void => setPhase(moonPhase(new Date()));
    update();
    const id = setInterval(update, RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return phase;
}
