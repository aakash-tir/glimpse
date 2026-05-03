import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildForecastUrl,
  fetchForecast,
  parseForecast,
  type Fetcher,
} from '../../src/main/data/open-meteo';

const FIXTURE_PATH = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'open-meteo',
  'forecast-success.json',
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

describe('buildForecastUrl', () => {
  it('embeds the lat/lon, timezone=auto, and the requested fields', () => {
    const url = buildForecastUrl({ latitude: 37.4, longitude: -122.08 });
    expect(url).toContain('latitude=37.4');
    expect(url).toContain('longitude=-122.08');
    expect(url).toContain('timezone=auto');
    expect(url).toContain('temperature_2m');
    expect(url).toContain('weather_code');
    expect(url).toContain('sunrise');
    expect(url).toContain('apparent_temperature');
    expect(url).toContain('relative_humidity_2m');
    expect(url).toContain('wind_speed_10m');
    expect(url).toContain('wind_direction_10m');
  });

  it('starts with the official Open-Meteo forecast endpoint', () => {
    expect(
      buildForecastUrl({ latitude: 0, longitude: 0 }).startsWith(
        'https://api.open-meteo.com/v1/forecast?',
      ),
    ).toBe(true);
  });
});

describe('parseForecast — current block', () => {
  it('returns the parsed current conditions', () => {
    const f = parseForecast(fixture());
    expect(f.timezone).toBe('America/Los_Angeles');
    expect(f.current.temperature).toBe(14.6);
    expect(f.current.apparentTemperature).toBe(13.2);
    expect(f.current.humidity).toBe(72);
    expect(f.current.weatherCode).toBe(2);
    expect(f.current.condition).toBe('partly-cloudy');
    expect(f.current.windSpeed).toBe(9.3);
    expect(f.current.windDirection).toBe(220);
  });
});

describe('parseForecast — hourly block', () => {
  it('produces 24 hourly rows for the bundled fixture', () => {
    const f = parseForecast(fixture());
    expect(f.hourly).toHaveLength(24);
  });

  it('each hour carries the resolved Condition', () => {
    const f = parseForecast(fixture());
    // Hour 0 has weather_code 0 → clear
    expect(f.hourly[0]!.condition).toBe('clear');
    // Hour 6 has weather_code 2 → partly-cloudy
    expect(f.hourly[6]!.condition).toBe('partly-cloudy');
  });
});

describe('parseForecast — daily block', () => {
  it('produces 7 daily rows for the bundled fixture', () => {
    const f = parseForecast(fixture());
    expect(f.daily).toHaveLength(7);
  });

  it('day 0 (today) has the expected high / low / sunrise / sunset', () => {
    const f = parseForecast(fixture());
    const today = f.daily[0]!;
    expect(today.date).toBe('2026-05-03');
    expect(today.high).toBe(21.5);
    expect(today.low).toBe(9.7);
    expect(today.sunrise).toBe('2026-05-03T06:11');
    expect(today.sunset).toBe('2026-05-03T20:01');
  });

  it('translates each daily weather_code to a Condition', () => {
    const f = parseForecast(fixture());
    expect(f.daily[2]!.condition).toBe('clear'); // code 0
    expect(f.daily[4]!.condition).toBe('rain'); // code 61
    expect(f.daily[5]!.condition).toBe('rain'); // code 80 (showers)
    expect(f.daily[6]!.condition).toBe('cloudy'); // code 3
  });
});

describe('parseForecast — error handling', () => {
  it('throws when the response is not an object', () => {
    expect(() => parseForecast(null)).toThrow();
    expect(() => parseForecast([])).toThrow();
  });

  it('throws when the current block is missing or malformed', () => {
    const f = fixture() as Record<string, unknown>;
    delete f['current'];
    expect(() => parseForecast(f)).toThrow();
  });

  it('throws when hourly arrays have mismatched lengths', () => {
    const f = fixture() as Record<string, unknown>;
    const h = f['hourly'] as Record<string, unknown>;
    h['temperature_2m'] = [1, 2, 3]; // wrong length
    expect(() => parseForecast(f)).toThrow(/hourly arrays mismatched length/);
  });

  it('coerces null precipitation_probability to 0', () => {
    const f = fixture() as Record<string, unknown>;
    const h = f['hourly'] as Record<string, unknown>;
    const pops = (h['precipitation_probability'] as number[]).slice();
    // Open-Meteo sometimes returns null for the very-near-future; must not crash.
    pops[0] = null as unknown as number;
    h['precipitation_probability'] = pops;
    const out = parseForecast(f);
    expect(out.hourly[0]!.precipitationProbability).toBe(0);
  });
});

describe('fetchForecast', () => {
  it('returns the parsed forecast on a 200 OK', async () => {
    const f = await fetchForecast(
      { latitude: 37.4, longitude: -122.08 },
      fetcherReturning(fixture()),
    );
    expect(f.current.temperature).toBe(14.6);
    expect(f.daily).toHaveLength(7);
  });

  it('throws on a non-OK HTTP status', async () => {
    await expect(
      fetchForecast(
        { latitude: 0, longitude: 0 },
        fetcherReturning({}, false, 502),
      ),
    ).rejects.toThrow(/HTTP 502/);
  });

  it('issues exactly one fetch with the lat/lon-bearing URL', async () => {
    const fetcher = fetcherReturning(fixture());
    await fetchForecast({ latitude: 37.4, longitude: -122.08 }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = vi.mocked(fetcher).mock.calls[0]?.[0] ?? '';
    expect(url).toContain('latitude=37.4');
    expect(url).toContain('longitude=-122.08');
  });
});
