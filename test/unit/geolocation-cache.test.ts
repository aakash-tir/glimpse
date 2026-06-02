import { describe, it, expect, vi } from 'vitest';
import { withLocationCache } from '../../src/main/data/geolocation-cache';
import type { GeolocationResult } from '../../src/main/data/geolocation';

const KELOWNA: GeolocationResult = {
  latitude: 49.888,
  longitude: -119.496,
  city: 'Kelowna',
};
const VANCOUVER: GeolocationResult = {
  latitude: 49.2827,
  longitude: -123.1207,
  city: 'Vancouver',
};

/** Minimal in-memory cache backing the wrapper for tests. */
function memoryCache(initial: GeolocationResult | null = null) {
  let value = initial;
  return {
    read: vi.fn(() => value),
    write: vi.fn((g: GeolocationResult) => {
      value = g;
    }),
    get value() {
      return value;
    },
  };
}

describe('withLocationCache', () => {
  it('persists and returns the fresh result on success', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn().mockResolvedValue(KELOWNA);

    const wrapped = withLocationCache(fetcher, cache);
    const result = await wrapped();

    expect(result).toEqual(KELOWNA);
    expect(cache.write).toHaveBeenCalledWith(KELOWNA);
    expect(cache.value).toEqual(KELOWNA);
  });

  it('returns the cached result (no throw) when the fetch fails and a cache exists', async () => {
    const cache = memoryCache(KELOWNA);
    const fetcher = vi.fn().mockRejectedValue(new Error('HTTP 429'));

    const wrapped = withLocationCache(fetcher, cache);
    const result = await wrapped();

    expect(result).toEqual(KELOWNA);
    expect(cache.write).not.toHaveBeenCalled();
  });

  it('re-throws the original error when the fetch fails and no cache exists (first launch)', async () => {
    const cache = memoryCache(null);
    const err = new Error('HTTP 429');
    const fetcher = vi.fn().mockRejectedValue(err);

    const wrapped = withLocationCache(fetcher, cache);

    await expect(wrapped()).rejects.toThrow(err);
    expect(cache.write).not.toHaveBeenCalled();
  });

  it('refreshes the cache when a later fetch succeeds after an earlier failure', async () => {
    const cache = memoryCache(KELOWNA);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('outage'))
      .mockResolvedValueOnce(VANCOUVER);

    const wrapped = withLocationCache(fetcher, cache);

    // First call: provider down → falls back to the cached Kelowna.
    expect(await wrapped()).toEqual(KELOWNA);
    // Second call: provider recovers → fresh Vancouver overwrites cache.
    expect(await wrapped()).toEqual(VANCOUVER);
    expect(cache.value).toEqual(VANCOUVER);
  });

  it('preserves a null city through the cache', async () => {
    const noCity: GeolocationResult = {
      latitude: 10,
      longitude: 20,
      city: null,
    };
    const cache = memoryCache();
    const fetcher = vi.fn().mockResolvedValue(noCity);

    const wrapped = withLocationCache(fetcher, cache);
    expect(await wrapped()).toEqual(noCity);
    expect(cache.write).toHaveBeenCalledWith(noCity);
  });
});
