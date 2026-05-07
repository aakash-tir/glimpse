import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchKp,
  parseKpResponse,
  type Fetcher,
} from '../../src/main/data/noaa-swpc';

const FIXTURE_PATH = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'noaa-swpc',
  'planetary-k-index.json',
);

function fixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
}

function fetcherReturning(payload: unknown, ok = true, status = 200): Fetcher {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(payload),
    }),
  );
}

describe('parseKpResponse', () => {
  it('returns the latest Kp from the bundled NOAA fixture', () => {
    const result = parseKpResponse(fixture());
    expect(result.kp).toBeCloseTo(5.33);
    expect(result.observedAtUtc).toBe('2026-05-03T09:00:00Z');
  });

  it('handles string Kp cells (some NOAA mirrors return strings)', () => {
    const result = parseKpResponse([
      { time_tag: '2026-05-03T09:00:00', Kp: '4.5' },
    ]);
    expect(result.kp).toBe(4.5);
  });

  it('throws when the response is empty / not an array', () => {
    expect(() => parseKpResponse(null)).toThrow();
    expect(() => parseKpResponse([])).toThrow();
  });

  it('throws when the latest entry is missing required fields', () => {
    expect(() =>
      parseKpResponse([{ time_tag: '2026-05-03T09:00:00' }]),
    ).toThrow();
    expect(() => parseKpResponse([{ Kp: 3.0 }])).toThrow();
  });

  it('throws when the latest Kp is non-finite or out of range', () => {
    expect(() =>
      parseKpResponse([{ time_tag: '2026-05-03T09:00:00', Kp: 99 }]),
    ).toThrow();
    expect(() =>
      parseKpResponse([{ time_tag: '2026-05-03T09:00:00', Kp: 'NaN' }]),
    ).toThrow();
  });
});

describe('fetchKp', () => {
  it('returns the parsed reading on a 200 OK', async () => {
    const result = await fetchKp(fetcherReturning(fixture()));
    expect(result.kp).toBeCloseTo(5.33);
  });

  it('throws on a non-OK HTTP status', async () => {
    await expect(fetchKp(fetcherReturning({}, false, 500))).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it('hits the NOAA SWPC planetary-K-index endpoint exactly once', async () => {
    const fetcher = fetcherReturning(fixture());
    await fetchKp(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
    );
  });
});
