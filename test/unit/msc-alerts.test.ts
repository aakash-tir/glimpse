import { describe, it, expect, vi } from 'vitest';
import {
  ALERT_BBOX_HALF_DEG,
  buildAlertsUrl,
  fetchAlerts,
  parseAlerts,
} from '../../src/main/data/msc-alerts';

const KELOWNA = { latitude: 49.88, longitude: -119.5 };

/** Shaped like a real GeoMet weather-alerts feature. */
function feature(over: Record<string, unknown> = {}): unknown {
  return {
    id: 'urn:x-msc:alert:1',
    type: 'Feature',
    properties: {
      alert_type: 'watch',
      alert_name_en: 'severe thunderstorm watch',
      alert_text_en: 'Conditions this evening will be favourable.',
      feature_name_en: 'Central Okanagan',
      status_en: 'continued',
      risk_colour_en: 'yellow',
      expiration_datetime: '2026-08-11T05:59:58.878Z',
      ...over,
    },
  };
}

const collection = (features: unknown[]): unknown => ({
  type: 'FeatureCollection',
  features,
});

describe('buildAlertsUrl', () => {
  it('queries a bbox centred on the resolved location', () => {
    const url = new URL(buildAlertsUrl(KELOWNA));
    expect(url.origin + url.pathname).toBe(
      'https://api.weather.gc.ca/collections/weather-alerts/items',
    );
    const [w, s, e, n] = (url.searchParams.get('bbox') ?? '')
      .split(',')
      .map(Number);
    const d = ALERT_BBOX_HALF_DEG;
    expect(w).toBeCloseTo(KELOWNA.longitude - d, 6);
    expect(s).toBeCloseTo(KELOWNA.latitude - d, 6);
    expect(e).toBeCloseTo(KELOWNA.longitude + d, 6);
    expect(n).toBeCloseTo(KELOWNA.latitude + d, 6);
  });

  it('requests JSON and caps the result count', () => {
    const url = new URL(buildAlertsUrl(KELOWNA));
    expect(url.searchParams.get('f')).toBe('json');
    expect(Number(url.searchParams.get('limit'))).toBeGreaterThan(0);
  });
});

describe('parseAlerts', () => {
  it('parses a live-shaped feature into the internal model', () => {
    const [a] = parseAlerts(collection([feature()]));
    expect(a).toMatchObject({
      severity: 'watch',
      title: 'Severe thunderstorm watch', // sentence-cased
      areas: ['Central Okanagan'],
      riskColour: 'yellow',
      expiresAtUtc: '2026-08-11T05:59:58.878Z',
    });
  });

  it('does not carry the bulletin body into the model', () => {
    // alert_text_en runs to thousands of characters of health advice;
    // the glance slide has no place for it (plan/slides.md).
    const [a] = parseAlerts(collection([feature()]));
    expect(JSON.stringify(a)).not.toContain('Conditions this evening');
  });

  it('classifies a warning as a warning', () => {
    const [a] = parseAlerts(collection([feature({ alert_type: 'warning' })]));
    expect(a?.severity).toBe('warning');
  });

  it('skips features with no usable title rather than rendering a blank slide', () => {
    expect(
      parseAlerts(
        collection([
          feature({ alert_name_en: '' }),
          feature({ alert_name_en: null }),
        ]),
      ),
    ).toHaveLength(0);
  });

  it('tolerates missing optional fields', () => {
    const [a] = parseAlerts(
      collection([
        feature({
          feature_name_en: undefined,
          risk_colour_en: undefined,
          expiration_datetime: undefined,
        }),
      ]),
    );
    expect(a?.areas).toEqual([]);
    expect(a?.riskColour).toBeNull();
    expect(a?.expiresAtUtc).toBeNull();
  });

  it('drops ended bulletins, which the expiry filter cannot catch', () => {
    // Live case: status_en "ended" with an expiration_datetime still
    // 17 hours out, so dropExpired would happily keep it.
    const parsed = parseAlerts(
      collection([
        feature({ status_en: 'ended', alert_name_en: 'air quality warning' }),
        feature({ status_en: 'continued' }),
        feature({ status_en: 'issued', alert_name_en: 'heat warning' }),
      ]),
    );
    expect(parsed.map((a) => a.title)).toEqual([
      'Severe thunderstorm watch',
      'Heat warning',
    ]);
  });

  it('is case-insensitive about the ended status', () => {
    expect(parseAlerts(collection([feature({ status_en: 'Ended' })]))).toEqual(
      [],
    );
  });

  it('keeps a feature whose status is missing', () => {
    // Absent status is not evidence the bulletin ended.
    const parsed = parseAlerts(collection([feature({ status_en: undefined })]));
    expect(parsed).toHaveLength(1);
  });

  it('gives same-named alerts distinct ids so they do not collapse onto one slide', () => {
    const parsed = parseAlerts(
      collection([
        { type: 'Feature', properties: { alert_name_en: 'heat warning' } },
        { type: 'Feature', properties: { alert_name_en: 'heat warning' } },
      ]),
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).not.toBe(parsed[1]?.id);
  });

  it('returns an empty list for a malformed or empty payload', () => {
    // The Canada-only case looks exactly like this: no features.
    expect(parseAlerts(collection([]))).toEqual([]);
    expect(parseAlerts({})).toEqual([]);
    expect(parseAlerts(null)).toEqual([]);
    expect(parseAlerts('nope')).toEqual([]);
    expect(parseAlerts({ features: 'not-an-array' })).toEqual([]);
  });

  it('skips malformed features without discarding the good ones', () => {
    const parsed = parseAlerts(
      collection([null, 'x', feature(), { type: 'F' }]),
    );
    expect(parsed).toHaveLength(1);
  });
});

describe('fetchAlerts', () => {
  it('returns parsed alerts on success', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(collection([feature()])),
      }),
    );
    const out = await fetchAlerts(KELOWNA, fetcher);
    expect(out).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-OK response so the store can hide the slides', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      }),
    );
    await expect(fetchAlerts(KELOWNA, fetcher)).rejects.toThrow('503');
  });
});
