// Resilience wrapper around the IP-geolocation client.
//
// Per plan/packaging.md (M10 cached-location fallback): the primary path
// is still detect-on-launch (plan/data-sources.md). This wrapper adds a
// safety net for production: every successful detection is persisted, and
// when the provider is unreachable (rate limit, transient outage) we reuse
// the last persisted result instead of dropping straight into the error
// state.
//
// First-ever launch has no cache, so a provider failure still propagates
// (the store maps that to errorState = 'error' as before). The cache is a
// fallback only — it never overrides a fresh successful detection.
//
// Kept pure: the actual settings.json read/write is injected via `cache`,
// so this module is unit-testable without touching the filesystem.

import type { GeolocationResult } from './geolocation';

export type LocationCache = {
  /** Last persisted result, or null if nothing has been cached yet. */
  read: () => GeolocationResult | null;
  /** Persist the latest successful detection. */
  write: (result: GeolocationResult) => void;
};

/**
 * Wrap a geolocation fetcher with read-through caching.
 *
 * - Success → persist the result, then return it.
 * - Failure with a cache present → return the cached result (no throw).
 * - Failure with no cache → re-throw the original error (first-launch
 *   case, which the store surfaces as the error state).
 */
export function withLocationCache(
  fetchGeolocation: () => Promise<GeolocationResult>,
  cache: LocationCache,
): () => Promise<GeolocationResult> {
  return async () => {
    try {
      const fresh = await fetchGeolocation();
      cache.write(fresh);
      return fresh;
    } catch (err) {
      const cached = cache.read();
      if (cached) return cached;
      throw err;
    }
  };
}
