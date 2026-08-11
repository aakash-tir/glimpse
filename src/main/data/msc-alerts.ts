// Environment Canada severe-weather alerts client.
//
// Endpoint (GeoMet-OGC-API, no key):
//   https://api.weather.gc.ca/collections/weather-alerts/items
//     ?f=json&bbox=<w>,<s>,<e>,<n>&limit=...
//
// Response is a GeoJSON FeatureCollection; each feature's properties
// carry the bulletin:
//   { alert_type: "warning" | "watch" | ...,
//     alert_name_en: "Severe thunderstorm watch",
//     alert_text_en: "Conditions this evening will be favourable...",
//     risk_colour_en: "yellow" | "orange" | ...,
//     expiration_datetime: "2026-08-11T05:59:58.878Z", ... }
//
// Canada only — see plan/data-sources.md § Severe weather alerts for
// why that limitation is deliberate. Outside Canada the bbox simply
// matches nothing and the parser returns an empty list, which the store
// treats the same as "no alerts".

import { classifyAlertSeverity, type WeatherAlert } from '../../shared/alerts';
import { fetchWithTimeout } from './http';

const BASE = 'https://api.weather.gc.ca/collections/weather-alerts/items';

/**
 * Half-width of the query box in degrees. ~0.25° is roughly 25–30 km
 * here — wide enough to catch an alert whose polygon covers the region
 * without pulling in a neighbouring province's bulletins.
 */
export const ALERT_BBOX_HALF_DEG = 0.25;

/** Cap the response; a location with more live alerts than this is
 * already saturated and the extras would never be paged to. */
const LIMIT = 20;

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

export function buildAlertsUrl(input: {
  latitude: number;
  longitude: number;
}): string {
  const { latitude: lat, longitude: lon } = input;
  const d = ALERT_BBOX_HALF_DEG;
  const params = new URLSearchParams({
    f: 'json',
    limit: String(LIMIT),
    bbox: [lon - d, lat - d, lon + d, lat + d].join(','),
  });
  return `${BASE}?${params.toString()}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * GeoJSON FeatureCollection → WeatherAlert[]. Features missing a usable
 * title are skipped rather than rendered as a blank slide; everything
 * else degrades to a sensible default.
 */
export function parseAlerts(raw: unknown): WeatherAlert[] {
  if (!isPlainObject(raw)) return [];
  const features = raw['features'];
  if (!Array.isArray(features)) return [];

  const out: WeatherAlert[] = [];
  features.forEach((feature, i) => {
    if (!isPlainObject(feature)) return;
    const props = feature['properties'];
    if (!isPlainObject(props)) return;

    const title = str(props['alert_name_en']);
    if (title === null) return;

    // MSC has no stable per-alert id field across responses, so key on
    // the bulletin identity we do have. Falls back to the index so two
    // same-named alerts can't collapse onto one slide.
    const id =
      str(feature['id']) ??
      `${title.toLowerCase().replace(/\s+/g, '-')}-${String(i)}`;

    out.push({
      id,
      severity: classifyAlertSeverity(props['alert_type']),
      title: sentenceCase(title),
      description: str(props['alert_text_en']) ?? '',
      riskColour: str(props['risk_colour_en']),
      expiresAtUtc: str(props['expiration_datetime']),
    });
  });
  return out;
}

/** MSC returns lowercase names ("severe thunderstorm watch"). */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function fetchAlerts(
  input: { latitude: number; longitude: number },
  fetcher: Fetcher = defaultFetcher,
): Promise<WeatherAlert[]> {
  const res = await fetcher(buildAlertsUrl(input));
  if (!res.ok) {
    throw new Error(`MSC alerts request failed: ${String(res.status)}`);
  }
  return parseAlerts(await res.json());
}
