// IP-geolocation client.
//
// Per plan/data-sources.md: auto-detect on every launch via IP, no key,
// no Google service, no Windows Location Services prompt. Accuracy is
// ~city-level which is fine for forecast and aurora-band lookups.
//
// Provider: geojs.io — keyless, HTTPS, no documented rate limit for
// personal use. Returns lat/lon as strings (we coerce to numbers) and
// city as a string.
//
// Provider history:
//   - Started on ipapi.co. Free tier rate-limited aggressively during
//     dev (HTTP 429 within ~50 launches) so we swapped.
//   - Tried ipwho.is. Their Cloudflare zone runs bot-fight mode that
//     rejects Node's fetch TLS fingerprint with HTTP 403 even with a
//     real User-Agent. curl works (different fingerprint) but Node /
//     undici doesn't.
//   - Settled on geojs.io. Cloudflare-fronted but the zone is
//     configured for keyless backend use (CORS open, no bot-fight) so
//     Node fetch reaches it cleanly.

const ENDPOINT = 'https://get.geojs.io/v1/ip/geo.json';

export type GeolocationResult = {
  latitude: number;
  longitude: number;
  /** Optional city name; useful for the future "show city" affordance. */
  city: string | null;
};

// Injectable for tests.
export type Fetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const defaultFetcher: Fetcher = (url) =>
  fetch(url).then((res) => ({
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  }));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// geojs.io returns lat/lon as strings (e.g. "50.0528"), but defensive
// against a future schema change we accept either strings or numbers.
function coerceCoord(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseGeolocation(raw: unknown): GeolocationResult {
  if (!isPlainObject(raw)) {
    throw new Error('geolocation: response was not a JSON object');
  }
  const lat = coerceCoord(raw['latitude']);
  const lon = coerceCoord(raw['longitude']);
  if (lat === null) {
    throw new Error('geolocation: missing or invalid latitude');
  }
  if (lon === null) {
    throw new Error('geolocation: missing or invalid longitude');
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('geolocation: latitude/longitude out of range');
  }
  const city = typeof raw['city'] === 'string' ? raw['city'] : null;
  return { latitude: lat, longitude: lon, city };
}

export async function fetchGeolocation(
  fetcher: Fetcher = defaultFetcher,
): Promise<GeolocationResult> {
  const res = await fetcher(ENDPOINT);
  if (!res.ok) {
    throw new Error(`geolocation: HTTP ${res.status}`);
  }
  const raw = await res.json();
  return parseGeolocation(raw);
}
