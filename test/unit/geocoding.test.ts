import { describe, expect, it, vi } from 'vitest';
import {
  buildGeocodingUrl,
  geocodeByName,
  parseGeocodingResponse,
} from '../../src/main/data/geocoding';

const KELOWNA_RESPONSE = {
  results: [
    {
      id: 5946186,
      name: 'Kelowna',
      latitude: 49.88307,
      longitude: -119.48568,
      country: 'Canada',
      admin1: 'British Columbia',
    },
  ],
  generationtime_ms: 0.42,
};

describe('buildGeocodingUrl', () => {
  it('encodes the name and includes the count + format params', () => {
    const url = buildGeocodingUrl('Kelowna');
    expect(url).toMatch(
      /^https:\/\/geocoding-api\.open-meteo\.com\/v1\/search/,
    );
    expect(url).toContain('name=Kelowna');
    expect(url).toContain('count=1');
    expect(url).toContain('format=json');
  });

  it('trims whitespace before encoding', () => {
    const url = buildGeocodingUrl('  Kelowna  ');
    expect(url).toContain('name=Kelowna');
    expect(url).not.toContain('+++Kelowna');
  });

  it('URL-encodes special characters', () => {
    const url = buildGeocodingUrl('São Paulo');
    expect(url).toContain('name=S%C3%A3o+Paulo');
  });
});

describe('parseGeocodingResponse', () => {
  it('extracts the first match from a well-formed response', () => {
    const match = parseGeocodingResponse(KELOWNA_RESPONSE);
    expect(match).toEqual({
      name: 'Kelowna',
      latitude: 49.88307,
      longitude: -119.48568,
      country: 'Canada',
      admin1: 'British Columbia',
    });
  });

  it('returns null when results is empty', () => {
    expect(parseGeocodingResponse({ results: [] })).toBeNull();
  });

  it('returns null when results is missing entirely', () => {
    expect(parseGeocodingResponse({})).toBeNull();
  });

  it('returns null when the response is not a JSON object', () => {
    expect(parseGeocodingResponse(null)).toBeNull();
    expect(parseGeocodingResponse('string')).toBeNull();
    expect(parseGeocodingResponse([])).toBeNull();
  });

  it('returns null when the first result is missing required fields', () => {
    expect(
      parseGeocodingResponse({
        results: [
          { name: 'Kelowna', latitude: 'not a number', longitude: -119.5 },
        ],
      }),
    ).toBeNull();
    expect(
      parseGeocodingResponse({
        results: [{ name: '', latitude: 49.88, longitude: -119.5 }],
      }),
    ).toBeNull();
  });

  it('tolerates missing country/admin1 fields', () => {
    const match = parseGeocodingResponse({
      results: [{ name: 'X', latitude: 1, longitude: 2 }],
    });
    expect(match).toEqual({
      name: 'X',
      latitude: 1,
      longitude: 2,
      country: null,
      admin1: null,
    });
  });
});

describe('geocodeByName', () => {
  it('returns null for empty / whitespace-only input without making a request', async () => {
    const fetcher = vi.fn();
    expect(await geocodeByName('', fetcher)).toBeNull();
    expect(await geocodeByName('   ', fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes the trimmed name to the URL builder', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => KELOWNA_RESPONSE,
    });
    await geocodeByName('  Kelowna  ', fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toContain('name=Kelowna');
  });

  it('returns the parsed match on a 200 response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => KELOWNA_RESPONSE,
    });
    const match = await geocodeByName('Kelowna', fetcher);
    expect(match?.name).toBe('Kelowna');
    expect(match?.latitude).toBeCloseTo(49.88307);
  });

  it('returns null when the API has no match (empty results array)', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    });
    expect(await geocodeByName('Atlantis', fetcher)).toBeNull();
  });

  it('throws on non-2xx responses so the caller can distinguish from "no match"', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    await expect(geocodeByName('Kelowna', fetcher)).rejects.toThrow(/HTTP 503/);
  });
});
