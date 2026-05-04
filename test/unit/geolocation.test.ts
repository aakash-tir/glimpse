import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchGeolocation,
  parseGeolocation,
  type Fetcher,
} from '../../src/main/data/geolocation';

const FIXTURE_PATH = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'ip-geolocation',
  'geojs-io-success.json',
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

describe('parseGeolocation', () => {
  it('parses the canonical geojs.io payload (string lat/lon)', () => {
    const result = parseGeolocation(fixture());
    expect(result.latitude).toBeCloseTo(37.4056);
    expect(result.longitude).toBeCloseTo(-122.0775);
    expect(result.city).toBe('Mountain View');
  });

  it('also accepts numeric lat/lon (defensive against future schema changes)', () => {
    const result = parseGeolocation({
      latitude: 51.5,
      longitude: -0.1,
      city: 'London',
    });
    expect(result.latitude).toBeCloseTo(51.5);
    expect(result.longitude).toBeCloseTo(-0.1);
  });

  it('returns city = null when the field is missing', () => {
    const result = parseGeolocation({ latitude: 0, longitude: 0 });
    expect(result.city).toBeNull();
  });

  it('throws on non-object input', () => {
    expect(() => parseGeolocation(null)).toThrow();
    expect(() => parseGeolocation('oops')).toThrow();
    expect(() => parseGeolocation([1, 2])).toThrow();
  });

  it('throws when latitude / longitude are missing or NaN', () => {
    expect(() => parseGeolocation({ longitude: 1 })).toThrow();
    expect(() => parseGeolocation({ latitude: 1 })).toThrow();
    expect(() => parseGeolocation({ latitude: NaN, longitude: 1 })).toThrow();
    expect(() =>
      parseGeolocation({ latitude: 1, longitude: 'west' }),
    ).toThrow();
  });

  it('throws on out-of-range coordinates', () => {
    expect(() => parseGeolocation({ latitude: 91, longitude: 0 })).toThrow();
    expect(() => parseGeolocation({ latitude: 0, longitude: -181 })).toThrow();
  });
});

describe('fetchGeolocation', () => {
  it('returns the parsed result on a 200 OK', async () => {
    const result = await fetchGeolocation(fetcherReturning(fixture()));
    expect(result.latitude).toBeCloseTo(37.4056);
    expect(result.city).toBe('Mountain View');
  });

  it('throws on a non-OK HTTP status', async () => {
    await expect(
      fetchGeolocation(fetcherReturning({}, false, 503)),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('throws when the response body is malformed', async () => {
    await expect(
      fetchGeolocation(
        fetcherReturning({ latitude: 'north', longitude: 'east' }),
      ),
    ).rejects.toThrow();
  });

  it('hits the geojs.io endpoint exactly once', async () => {
    const fetcher = fetcherReturning(fixture());
    await fetchGeolocation(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe(
      'https://get.geojs.io/v1/ip/geo.json',
    );
  });
});
