// The data-store snapshot shape exposed to the renderer over IPC.
// Lives in shared/ so both processes import the same type without
// bouncing through a network-style discriminator.

import type { Forecast } from './forecast';
import type { WeatherAlert } from './alerts';

export type DataLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
};

export type DataErrorState = 'ok' | 'error';

export type DataSnapshot = {
  /** Last successful geolocation. null until the first successful fetch. */
  location: DataLocation | null;
  /**
   * The IP-detected city from the most recent geolocation, regardless
   * of whether a user override is active. The Settings UI uses this
   * to decide which override entry (if any) is being edited — the
   * override list is keyed by detected city, so `location.city` (which
   * may be the user-entered city when an override is active) isn't
   * the right key to look up.
   */
  detectedCity: string | null;
  /** Last successful forecast. null until the first successful fetch. */
  forecast: Forecast | null;
  /** Latest Kp from NOAA, null while unset or after an SWPC failure. */
  kp: number | null;
  /** ISO timestamp of the last successful general-weather fetch. */
  lastUpdated: string | null;
  /**
   * 'error' = the icon should show its sad-cloud error state and the
   * backoff retry loop is active. Set when geolocation OR Open-Meteo
   * fails. Cleared back to 'ok' on the next successful fetch.
   */
  errorState: DataErrorState;
  /**
   * Sticky flag: once a NOAA fetch fails this session, the special-
   * events slide stays hidden until the app is restarted (per
   * plan/data-sources.md). Subsequent NOAA successes still update
   * `kp` (so the data is fresh for next launch) but the slide is
   * suppressed for this run.
   */
  eventsHidden: boolean;
  /**
   * Derived from (location.latitude, kp) via evaluateAuroraVisibility.
   * False when either input is missing.
   */
  auroraVisibleFromUserLocation: boolean;
  /**
   * Active Environment Canada alerts for the resolved location, already
   * sorted most-urgent-first and stripped of expired entries. Empty
   * outside Canada, when there are none, or after a failed fetch — the
   * three are deliberately indistinguishable to the renderer, which
   * just renders no alert slides.
   */
  alerts: readonly WeatherAlert[];
};

export const EMPTY_SNAPSHOT: DataSnapshot = {
  location: null,
  detectedCity: null,
  forecast: null,
  kp: null,
  lastUpdated: null,
  errorState: 'ok',
  eventsHidden: false,
  auroraVisibleFromUserLocation: false,
  alerts: [],
};
