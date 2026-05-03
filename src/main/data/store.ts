// In-memory data store. Composes the four data sources (geolocation,
// Open-Meteo, NOAA SWPC, plus the bundled astronomical helpers) into a
// single DataSnapshot that the renderer subscribes to over IPC.
//
// Failure semantics per plan/data-sources.md:
//   - Geolocation OR Open-Meteo failure → errorState = 'error', icon
//     enters its sad-cloud state, exponential backoff begins (5 → 10
//     → 20 → 40 → 60 cap). Recovery restores errorState = 'ok' and
//     resets the backoff counter.
//   - NOAA failure → eventsHidden flips true (sticky for the session
//     per spec — once hidden this run, the events slide stays hidden
//     even if NOAA recovers later). The other two data sources are
//     unaffected.
//
// The store does NOT own the scheduler — the host (main/index.ts)
// composes a TickScheduler around `refresh()` and wires powerMonitor
// resume notifications. This keeps the store testable without
// touching Electron APIs.

import { evaluateAuroraVisibility } from '../../shared/aurora';
import { backoffMinutesForAttempt } from '../../shared/backoff';
import { EMPTY_SNAPSHOT, type DataSnapshot } from '../../shared/data-snapshot';
import type { GeolocationResult } from './geolocation';
import type { KpReading } from './noaa-swpc';
import type { Forecast } from '../../shared/forecast';

export type StoreDeps = {
  fetchGeolocation: () => Promise<GeolocationResult>;
  fetchForecast: (input: {
    latitude: number;
    longitude: number;
  }) => Promise<Forecast>;
  fetchKp: () => Promise<KpReading>;
  /** Pluggable for tests. Defaults to the host wall clock. */
  now?: () => Date;
};

export type RefreshResult = {
  /** True if the general weather (location + forecast) succeeded this attempt. */
  weatherOk: boolean;
  /** True if NOAA succeeded this attempt. */
  noaaOk: boolean;
  /** Minutes until the next retry, when weatherOk is false. */
  nextRetryMinutes: number | null;
};

type Listener = (snapshot: DataSnapshot) => void;

export class DataStore {
  private snapshot: DataSnapshot = { ...EMPTY_SNAPSHOT };
  private readonly listeners = new Set<Listener>();
  private readonly deps: Required<Pick<StoreDeps, 'now'>> &
    Omit<StoreDeps, 'now'>;

  // Number of consecutive failed weather attempts. Drives the backoff
  // delay returned from refresh(). Reset to 0 on success.
  private weatherAttemptIndex = 0;

  constructor(deps: StoreDeps) {
    this.deps = {
      ...deps,
      now: deps.now ?? ((): Date => new Date()),
    };
  }

  getSnapshot(): DataSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Performs all fetches and updates the snapshot. Never throws —
  // errors map to state transitions (errorState, eventsHidden) instead
  // so the caller (scheduler) doesn't need try/catch around every tick.
  async refresh(): Promise<RefreshResult> {
    let weatherOk = true;
    let location = this.snapshot.location;
    let forecast = this.snapshot.forecast;

    // Step 1: location. A stale location is reusable if it still
    // exists from an earlier success — the spec says general failure
    // sets errorState; it doesn't require dropping previously-good
    // location data. But on first launch, no location = can't fetch.
    try {
      const fresh = await this.deps.fetchGeolocation();
      location = {
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        city: fresh.city,
      };
    } catch {
      weatherOk = false;
    }

    // Step 2: forecast (depends on a known location).
    if (weatherOk && location) {
      try {
        forecast = await this.deps.fetchForecast({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      } catch {
        weatherOk = false;
      }
    } else if (!location) {
      // Geolocation failed and we've never had a location. Forecast
      // can't run — count this as a weather failure.
      weatherOk = false;
    }

    // Step 3: NOAA Kp. Independent of weather outcome.
    let noaaOk = true;
    let kp = this.snapshot.kp;
    try {
      const reading = await this.deps.fetchKp();
      kp = reading.kp;
    } catch {
      noaaOk = false;
    }

    // Update backoff counter and compute next-retry minutes.
    let nextRetryMinutes: number | null = null;
    if (weatherOk) {
      this.weatherAttemptIndex = 0;
    } else {
      nextRetryMinutes = backoffMinutesForAttempt(this.weatherAttemptIndex);
      this.weatherAttemptIndex++;
    }

    // Aurora visibility derives from current location + Kp.
    const auroraVisibleFromUserLocation =
      location !== null && kp !== null
        ? evaluateAuroraVisibility({
            latitude: location.latitude,
            kp,
          }).visibleFromUserLocation
        : false;

    const next: DataSnapshot = {
      location,
      forecast,
      kp,
      lastUpdated: weatherOk
        ? this.deps.now().toISOString()
        : this.snapshot.lastUpdated,
      errorState: weatherOk ? 'ok' : 'error',
      // Sticky: once true this session, stays true even if NOAA
      // recovers later. Underlying kp still updates so a subsequent
      // launch sees fresh data immediately.
      eventsHidden: this.snapshot.eventsHidden || !noaaOk,
      auroraVisibleFromUserLocation,
    };

    this.commit(next);

    return { weatherOk, noaaOk, nextRetryMinutes };
  }

  private commit(next: DataSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }
}
