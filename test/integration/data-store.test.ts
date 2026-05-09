import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataStore } from '../../src/main/data/store';
import type { Forecast } from '../../src/shared/forecast';
import { parseForecast } from '../../src/main/data/open-meteo';

const FIXTURE = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'open-meteo',
  'forecast-success.json',
);

function fixtureForecast(): Forecast {
  return parseForecast(JSON.parse(readFileSync(FIXTURE, 'utf-8')));
}

const sampleLocation = {
  latitude: 65,
  longitude: -150,
  city: 'Fairbanks',
};

function makeDeps(overrides?: {
  forecastImpl?: () => Promise<Forecast>;
  kpImpl?: () => Promise<{ kp: number; observedAtUtc: string }>;
  geoImpl?: () => Promise<typeof sampleLocation>;
}): {
  fetchGeolocation: ReturnType<typeof vi.fn>;
  fetchForecast: ReturnType<typeof vi.fn>;
  fetchKp: ReturnType<typeof vi.fn>;
} {
  return {
    fetchGeolocation: vi.fn(
      overrides?.geoImpl ?? (() => Promise.resolve(sampleLocation)),
    ),
    fetchForecast: vi.fn(
      overrides?.forecastImpl ?? (() => Promise.resolve(fixtureForecast())),
    ),
    fetchKp: vi.fn(
      overrides?.kpImpl ??
        (() =>
          Promise.resolve({
            kp: 5,
            observedAtUtc: '2026-05-03T09:00:00.000Z',
          })),
    ),
  };
}

describe('DataStore — happy path', () => {
  it('first refresh populates location, forecast, kp, and lastUpdated', async () => {
    const deps = makeDeps();
    const store = new DataStore(deps);
    await store.refresh();
    const snap = store.getSnapshot();
    expect(snap.location?.city).toBe('Fairbanks');
    expect(snap.forecast?.timezone).toBe('America/Los_Angeles');
    expect(snap.kp).toBe(5);
    expect(snap.errorState).toBe('ok');
    expect(snap.eventsHidden).toBe(false);
    expect(snap.lastUpdated).not.toBeNull();
  });

  it('derives auroraVisibleFromUserLocation from location.latitude + kp', async () => {
    // Lat 65° (≥60° band, threshold Kp 4) + Kp 5 → visible.
    const deps = makeDeps();
    const store = new DataStore(deps);
    await store.refresh();
    expect(store.getSnapshot().auroraVisibleFromUserLocation).toBe(true);
  });

  it('subscribers receive every snapshot push', async () => {
    const deps = makeDeps();
    const store = new DataStore(deps);
    const listener = vi.fn();
    store.subscribe(listener);
    await store.refresh();
    await store.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('DataStore — Open-Meteo failure → error state + backoff', () => {
  it('forecast failure sets errorState=error and returns nextRetryMinutes=5', async () => {
    const deps = makeDeps({
      forecastImpl: () => Promise.reject(new Error('open-meteo down')),
    });
    const store = new DataStore(deps);
    const result = await store.refresh();
    expect(result.weatherOk).toBe(false);
    expect(result.nextRetryMinutes).toBe(5);
    expect(store.getSnapshot().errorState).toBe('error');
  });

  it('the backoff sequence advances on consecutive failures (5 → 10 → 20 → 40 → 60 → 60)', async () => {
    const deps = makeDeps({
      forecastImpl: () => Promise.reject(new Error('open-meteo down')),
    });
    const store = new DataStore(deps);
    const sequence: (number | null)[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await store.refresh();
      sequence.push(r.nextRetryMinutes);
    }
    expect(sequence).toEqual([5, 10, 20, 40, 60, 60]);
  });

  it('recovery on the next attempt restores errorState=ok and resets backoff', async () => {
    let shouldFail = true;
    const deps = makeDeps({
      forecastImpl: () =>
        shouldFail
          ? Promise.reject(new Error('open-meteo down'))
          : Promise.resolve(fixtureForecast()),
    });
    const store = new DataStore(deps);
    const fail = await store.refresh();
    expect(fail.weatherOk).toBe(false);
    expect(store.getSnapshot().errorState).toBe('error');

    shouldFail = false;
    const ok = await store.refresh();
    expect(ok.weatherOk).toBe(true);
    expect(store.getSnapshot().errorState).toBe('ok');

    // Backoff index reset → a subsequent failure starts at 5 min
    // again, proving the counter zeroed out.
    shouldFail = true;
    const failAgain = await store.refresh();
    expect(failAgain.nextRetryMinutes).toBe(5);
  });

  it('geolocation failure (with no prior location) is also a weather failure', async () => {
    const deps = makeDeps({
      geoImpl: () => Promise.reject(new Error('geo down')),
    });
    const store = new DataStore(deps);
    await store.refresh();
    const snap = store.getSnapshot();
    expect(snap.errorState).toBe('error');
    expect(snap.location).toBeNull();
    // Forecast fetch never attempted because we have no location.
    expect(deps.fetchForecast).not.toHaveBeenCalled();
  });
});

describe('DataStore — NOAA failure → eventsHidden (sticky), other data unaffected', () => {
  it('a single NOAA failure flips eventsHidden but leaves forecast/location intact', async () => {
    const deps = makeDeps({
      kpImpl: () => Promise.reject(new Error('noaa down')),
    });
    const store = new DataStore(deps);
    const result = await store.refresh();
    expect(result.weatherOk).toBe(true);
    expect(result.noaaOk).toBe(false);
    const snap = store.getSnapshot();
    expect(snap.eventsHidden).toBe(true);
    expect(snap.forecast).not.toBeNull();
    expect(snap.location).not.toBeNull();
    expect(snap.errorState).toBe('ok');
  });

  it('eventsHidden is sticky — NOAA recovery does not flip it back', async () => {
    let noaaShouldFail = true;
    const deps = makeDeps({
      kpImpl: () =>
        noaaShouldFail
          ? Promise.reject(new Error('noaa down'))
          : Promise.resolve({
              kp: 6,
              observedAtUtc: '2026-05-03T12:00:00.000Z',
            }),
    });
    const store = new DataStore(deps);
    await store.refresh();
    expect(store.getSnapshot().eventsHidden).toBe(true);

    noaaShouldFail = false;
    await store.refresh();
    const snap = store.getSnapshot();
    // Sticky flag stays — but underlying kp DOES update so a
    // subsequent launch (fresh store) sees the recovered value.
    expect(snap.eventsHidden).toBe(true);
    expect(snap.kp).toBe(6);
  });
});

describe('DataStore — resolveCoords dep (location-priority handoff)', () => {
  it('uses the resolver coords for the forecast fetch when provided', async () => {
    const deps = makeDeps();
    const store = new DataStore({
      ...deps,
      resolveCoords: () => ({
        latitude: 49.96,
        longitude: -119.38,
        displayCity: 'Kelowna Airport',
        source: 'override',
      }),
    });
    await store.refresh();
    expect(deps.fetchForecast).toHaveBeenCalledWith({
      latitude: 49.96,
      longitude: -119.38,
    });
  });

  it('snapshots the resolver displayCity onto location.city, but exposes the IP-detected city separately', async () => {
    const deps = makeDeps();
    const store = new DataStore({
      ...deps,
      resolveCoords: () => ({
        latitude: 49.96,
        longitude: -119.38,
        displayCity: 'Kelowna Airport',
        source: 'override',
      }),
    });
    await store.refresh();
    const snap = store.getSnapshot();
    expect(snap.location?.city).toBe('Kelowna Airport');
    // detectedCity is always the IP-detected city, regardless of override.
    expect(snap.detectedCity).toBe('Fairbanks');
  });

  it('falls back to IP-detected coords when no resolver is provided', async () => {
    const deps = makeDeps();
    const store = new DataStore(deps);
    await store.refresh();
    expect(deps.fetchForecast).toHaveBeenCalledWith({
      latitude: 65,
      longitude: -150,
    });
    expect(store.getSnapshot().location?.city).toBe('Fairbanks');
    expect(store.getSnapshot().detectedCity).toBe('Fairbanks');
  });
});
