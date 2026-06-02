// Shared HTTP helper for the data clients.
//
// All four data sources (geolocation, Open-Meteo, NOAA SWPC, geocoding)
// previously used a bare `fetch(url)` with no timeout. Because the
// scheduler awaits each refresh tick (see scheduler.ts), a hung TCP
// connection would stall the whole refresh loop indefinitely with no
// error-state transition. Wrapping fetch with an abort-on-timeout signal
// bounds that: a stalled request rejects, which the clients already map
// to their failure paths (icon error state / backoff / hidden events).

/** Default per-request timeout. Generous enough for slow mobile links. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * `fetch` with an abort-on-timeout signal. Rejects with the underlying
 * network error, or a `TimeoutError` `DOMException` if the timeout
 * elapses first — either way the caller's existing catch treats it as a
 * fetch failure.
 */
export function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}
