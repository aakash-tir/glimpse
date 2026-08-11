// Open-Meteo's free geocoding API for the Settings → Advanced location
// "Look up by name" flow. Forward-only (name → coords); reverse
// geocoding is intentionally out of scope so we don't add another
// vendor for what's effectively a label-display niceity.
//
// Endpoint:
//   https://geocoding-api.open-meteo.com/v1/search?name=...&count=1
//
// Response shape (truncated to the fields we use):
//   {
//     results: [{
//       name: 'Kelowna',
//       latitude: 49.88307,
//       longitude: -119.48568,
//       country: 'Canada',
//       admin1: 'British Columbia',
//       ...
//     }]
//   }
//
// When no city matches, the API returns either an empty `results`
// array or omits the field entirely — both are normalised here to a
// null return so the renderer can show a "couldn't find it" error
// without distinguishing between the two.

import { fetchWithTimeout } from './http';

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

export type GeocodingMatch = {
  /** Canonical city name from the API (may differ from user input casing). */
  name: string;
  latitude: number;
  longitude: number;
  /** Optional human-readable hierarchy ("Canada", "British Columbia"). */
  country: string | null;
  admin1: string | null;
};

export type Fetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const defaultFetcher: Fetcher = (url) =>
  fetchWithTimeout(url).then((res) => ({
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  }));

export function buildGeocodingUrl(name: string): string {
  const params = new URLSearchParams({
    name: name.trim(),
    count: '1',
    language: 'en',
    format: 'json',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseGeocodingResponse(raw: unknown): GeocodingMatch | null {
  if (!isPlainObject(raw)) return null;
  const results = raw['results'];
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  if (!isPlainObject(first)) return null;
  const lat = first['latitude'];
  const lon = first['longitude'];
  const name = first['name'];
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null;
  if (typeof lon !== 'number' || !Number.isFinite(lon)) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  return {
    name,
    latitude: lat,
    longitude: lon,
    country: typeof first['country'] === 'string' ? first['country'] : null,
    admin1: typeof first['admin1'] === 'string' ? first['admin1'] : null,
  };
}

/**
 * Resolve a free-form city name to coordinates. Returns null when the
 * input is empty/whitespace OR when the API has no match. Throws on
 * network errors / non-2xx responses so the caller can distinguish
 * "no match" (null) from "we couldn't reach the server" (thrown).
 */
export async function geocodeByName(
  name: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<GeocodingMatch | null> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  const url = buildGeocodingUrl(trimmed);
  const res = await fetcher(url);
  if (!res.ok) {
    throw new Error(`geocoding: HTTP ${res.status}`);
  }
  const raw = await res.json();
  return parseGeocodingResponse(raw);
}
