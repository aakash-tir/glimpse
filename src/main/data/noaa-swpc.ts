// NOAA Space Weather Prediction Center — planetary K-index client.
//
// Endpoint:
//   https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
//
// Response is an array of objects, one per 3-hour observation:
//   [
//     { "time_tag": "2026-04-27T00:00:00", "Kp": 3.00,
//       "a_running": 15, "station_count": 8 },
//     ...
//   ]
//
// time_tag is UTC by convention (no trailing "Z"), Kp is a number.
//
// We only need the most recent Kp — the latest entry feeds the aurora
// visibility filter.

import { fetchWithTimeout } from './http';

const ENDPOINT =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

export type KpReading = {
  /** Most recent observed Kp value (0..9 typically, fractional). */
  kp: number;
  /** UTC ISO timestamp of the observation. */
  observedAtUtc: string;
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseKpResponse(raw: unknown): KpReading {
  if (!Array.isArray(raw) || raw.length < 1) {
    throw new Error('noaa-swpc: response was not a non-empty array');
  }
  // Last entry is the most recent observation.
  const last = raw[raw.length - 1];
  if (!isPlainObject(last)) {
    throw new Error('noaa-swpc: last entry was not an object');
  }
  const rawKp = last['Kp'];
  const rawTime = last['time_tag'];
  if (typeof rawKp !== 'string' && typeof rawKp !== 'number') {
    throw new Error('noaa-swpc: latest Kp value missing');
  }
  if (typeof rawTime !== 'string') {
    throw new Error('noaa-swpc: latest time_tag missing');
  }
  const kp = typeof rawKp === 'number' ? rawKp : Number.parseFloat(rawKp);
  if (!Number.isFinite(kp) || kp < 0 || kp > 9) {
    throw new Error(`noaa-swpc: Kp out of range (${rawKp})`);
  }
  // time_tag is UTC by convention but missing the trailing "Z". Append
  // it so downstream consumers can hand the string to Date directly.
  const observedAtUtc = rawTime.endsWith('Z') ? rawTime : `${rawTime}Z`;
  return { kp, observedAtUtc };
}

export async function fetchKp(
  fetcher: Fetcher = defaultFetcher,
): Promise<KpReading> {
  const res = await fetcher(ENDPOINT);
  if (!res.ok) {
    throw new Error(`noaa-swpc: HTTP ${res.status}`);
  }
  const raw = await res.json();
  return parseKpResponse(raw);
}
