// IP-geolocation client.
//
// Per plan/data-sources.md: auto-detect on every launch via IP, no key,
// no Google service, no Windows Location Services prompt. Accuracy is
// ~city-level which is fine for forecast and aurora-band lookups.
//
// Provider: ipapi.co — free tier (1k/day), HTTPS, returns lat/lon as
// numbers in a single GET. Personal-use Glimpse won't get anywhere
// near the rate cap.

const ENDPOINT = 'https://ipapi.co/json/';

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

export function parseGeolocation(raw: unknown): GeolocationResult {
  if (!isPlainObject(raw)) {
    throw new Error('geolocation: response was not a JSON object');
  }
  const lat = raw['latitude'];
  const lon = raw['longitude'];
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    throw new Error('geolocation: missing or invalid latitude');
  }
  if (typeof lon !== 'number' || !Number.isFinite(lon)) {
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
