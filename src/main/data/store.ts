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
import {
  dedupeAlerts,
  dropExpired,
  sortAlerts,
  type WeatherAlert,
} from '../../shared/alerts';
import type { GeolocationResult } from './geolocation';
import type { KpReading } from './noaa-swpc';
import type { Forecast } from '../../shared/forecast';

/** Outcome from the coord resolver — see StoreDeps.resolveCoords. */
export type ResolvedCoords = {
  /** Coordinates to actually fetch the forecast with. */
  latitude: number;
  longitude: number;
  /**
   * What to display as the "city" in the snapshot. When an override is
   * active this is the user-entered city name; otherwise it's the
   * IP-detected city.
   */
  displayCity: string | null;
  /** Which source ultimately won. Useful for diagnostics + tests. */
  source: 'override' | 'browser' | 'ip';
};

export type StoreDeps = {
  fetchGeolocation: () => Promise<GeolocationResult>;
  fetchForecast: (input: {
    latitude: number;
    longitude: number;
  }) => Promise<Forecast>;
  fetchKp: () => Promise<KpReading>;
  /**
   * Environment Canada alerts for the fetched coordinates. Optional so
   * existing tests (and any future non-Canadian build) can leave it
   * out — omitted means "no alerts", same as a failure.
   */
  fetchAlerts?: (input: {
    latitude: number;
    longitude: number;
  }) => Promise<WeatherAlert[]>;
  /**
   * Resolves the IP-detected location to the coordinates we should
   * actually fetch with. The host implementation reads current
   * settings (advancedLocationEnabled, locationOverrides,
   * browserGeolocation) so the priority logic stays out of the store.
   * If omitted, the IP-detected coords are used as-is.
   */
  resolveCoords?: (detected: GeolocationResult) => ResolvedCoords;
  /** Pluggable for tests. Defaults to the host wall clock. */
  now?: () => Date;
};

export type RefreshResult = {
  /** True if the general weather (location + forecast) succeeded this attempt. */
  weatherOk: boolean;
  /** True if NOAA succeeded this attempt. */
  noaaOk: boolean;
  /** True if the alerts fetch succeeded (or wasn't configured). */
  alertsOk: boolean;
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

  // The currently-running refresh, if any. See refresh() for why.
  private inFlight: Promise<RefreshResult> | null = null;

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
  //
  // Concurrent calls are COALESCED: a refresh that starts while another
  // is still in flight joins the running one instead of starting its
  // own. Without this, overlapping triggers (the clock-aligned :05 tick
  // landing on top of an expand-time refresh, or a manual Settings
  // refresh during either) would each run the full fetch chain and each
  // commit() — doubling the network calls, racing two snapshots into
  // the listeners, and, on failure, incrementing weatherAttemptIndex
  // twice so the backoff skipped a rung (5 → 20 instead of 5 → 10).
  //
  // The shared RefreshResult is correct for every joiner: they all
  // wanted "the data as of now", and the in-flight run delivers exactly
  // that. A caller needing a guaranteed-fresh fetch must await this one
  // first and then call again.
  refresh(): Promise<RefreshResult> {
    if (this.inFlight) return this.inFlight;
    const run = this.runRefresh().finally(() => {
      this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  private async runRefresh(): Promise<RefreshResult> {
    let weatherOk = true;
    let location = this.snapshot.location;
    let forecast = this.snapshot.forecast;

    // Step 1: location. A stale location is reusable if it still
    // exists from an earlier success — the spec says general failure
    // sets errorState; it doesn't require dropping previously-good
    // location data. But on first launch, no location = can't fetch.
    //
    // After IP-detection succeeds, resolveCoords (if provided) gets to
    // pick the actual coords for the forecast fetch — that's where the
    // user's manual overrides + browser geolocation enter the picture.
    let detectedCity: string | null = null;
    let fetchLat = 0;
    let fetchLon = 0;
    try {
      const fresh = await this.deps.fetchGeolocation();
      detectedCity = fresh.city;
      const resolved = this.deps.resolveCoords?.(fresh) ?? {
        latitude: fresh.latitude,
        longitude: fresh.longitude,
        displayCity: fresh.city,
        source: 'ip' as const,
      };
      fetchLat = resolved.latitude;
      fetchLon = resolved.longitude;
      location = {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        city: resolved.displayCity,
      };
    } catch {
      weatherOk = false;
    }

    // Step 2: forecast (depends on a known location).
    if (weatherOk && location) {
      try {
        forecast = await this.deps.fetchForecast({
          latitude: fetchLat,
          longitude: fetchLon,
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

    // Step 4: severe-weather alerts. Independent of both the weather
    // outcome and NOAA — a failure here hides the alert slides and
    // nothing else. Alerts must never drive the icon's error state:
    // the warning feed being down is not a weather-fetch failure.
    let alertsOk = true;
    let alerts = this.snapshot.alerts;
    if (this.deps.fetchAlerts && weatherOk && location) {
      try {
        const fresh = await this.deps.fetchAlerts({
          latitude: fetchLat,
          longitude: fetchLon,
        });
        alerts = sortAlerts(dedupeAlerts(dropExpired(fresh, this.deps.now())));
      } catch {
        alertsOk = false;
        // Drop stale alerts rather than showing a warning we can no
        // longer confirm is live.
        alerts = [];
      }
    } else if (this.deps.fetchAlerts) {
      // No usable location this tick — nothing to key alerts off.
      alerts = [];
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
      detectedCity: detectedCity ?? this.snapshot.detectedCity,
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
      alerts,
    };

    this.commit(next);

    return { weatherOk, noaaOk, alertsOk, nextRetryMinutes };
  }

  private commit(next: DataSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }
}
