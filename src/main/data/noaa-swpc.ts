// NOAA Space Weather Prediction Center — planetary K-index client.
//
// Endpoint:
//   https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
//
// Response is a CSV-like 2D array with a header row, then one row per
// 3-hour observation:
//   [
//     ["time_tag", "Kp", "a_running", "station_count"],
//     ["2024-01-01 00:00:00.000", "2.33", "5", "8"],
//     ...
//   ]
//
// We only need the most recent Kp — the latest entry feeds the aurora
// visibility filter.

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
  fetch(url).then((res) => ({
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  }));

export function parseKpResponse(raw: unknown): KpReading {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('noaa-swpc: response was not a non-empty array');
  }
  const header = raw[0];
  if (!Array.isArray(header)) {
    throw new Error('noaa-swpc: header row missing');
  }
  const timeIdx = header.indexOf('time_tag');
  const kpIdx = header.indexOf('Kp');
  if (timeIdx < 0 || kpIdx < 0) {
    throw new Error('noaa-swpc: header missing time_tag or Kp column');
  }
  // Last row is the most recent observation.
  const last = raw[raw.length - 1];
  if (!Array.isArray(last)) {
    throw new Error('noaa-swpc: last row was not an array');
  }
  const rawKp = last[kpIdx];
  const rawTime = last[timeIdx];
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
  // NOAA's time_tag uses "YYYY-MM-DD HH:mm:ss.sss" without a "T" or
  // explicit "Z". They're all UTC by convention; normalise into a
  // standard ISO string so downstream consumers can pass it to Date.
  const observedAtUtc = `${rawTime.replace(' ', 'T')}Z`;
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
