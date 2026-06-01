// Pure types + helpers for the persisted settings shape. NO Node
// built-ins (node:fs / node:path) are imported here so the file is
// safe for the renderer bundle. File I/O lives in
// src/main/settings-fs.ts and is consumed only by main.

export type Units = 'metric' | 'imperial';
export type TimeFormat = '12h' | '24h';
export type ThemeOverride = 'auto' | 'light' | 'dark';

export type IconPosition = { x: number; y: number };
export type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A user-supplied location override keyed by the IP-detected city it
 * applies to. When the IP geolocator reports `detectedCity`, the
 * data-store substitutes `latitude` / `longitude` for the forecast
 * fetch (instead of using the IP-detected coords). Travel away → the
 * override goes dormant because IP-detected city no longer matches.
 * Travel back → it reactivates automatically.
 */
export type LocationOverride = {
  /** IP-detected city this override applies to (the lookup key). */
  detectedCity: string;
  /** User-entered city name. Used for display in the Current slide. */
  city: string;
  latitude: number;
  longitude: number;
};

export type BrowserGeolocation = {
  latitude: number;
  longitude: number;
  /** ISO timestamp of when the browser geolocation API resolved. */
  capturedAt: string;
};

/**
 * The most recent successful IP-geolocation result, persisted so we can
 * fall back to it when the provider is unreachable (rate limit, transient
 * outage). This is a resilience cache only — the primary path is still
 * detect-on-launch per plan/data-sources.md. On a first-ever launch no
 * cache exists, so a provider failure still surfaces as the error state.
 */
export type CachedLocation = {
  latitude: number;
  longitude: number;
  /** IP-detected city at the time of caching. May be null. */
  city: string | null;
};

export type Settings = {
  units: Units;
  timeFormat: TimeFormat;
  iconPosition: IconPosition | null;
  moonPhaseSlideEnabled: boolean;
  themeOverride: ThemeOverride;
  trackWindowPosition: boolean;
  windowBounds: WindowBounds | null;
  onboardingCompleted: boolean;
  /**
   * Toggle for the "Advanced location" Settings section. When false,
   * any saved overrides are dormant and IP-detected coords (or
   * cached browser geolocation) drive the forecast. When true and
   * a matching override exists, the override wins.
   */
  advancedLocationEnabled: boolean;
  /**
   * Saved overrides per IP-detected city. Kept dormant when
   * advancedLocationEnabled is false; activated when it's true and
   * a matching `detectedCity` is present.
   */
  locationOverrides: LocationOverride[];
  /**
   * Cached coordinates from the browser's `navigator.geolocation`
   * API. Higher accuracy than IP geolocation but requires user
   * permission. Used as the second-priority source after explicit
   * overrides; falls back to IP if null.
   */
  browserGeolocation: BrowserGeolocation | null;
  /**
   * True once we've shown the first-launch permission prompt at
   * least once (regardless of allow/deny). Stops the prompt from
   * re-appearing every launch. The user can re-trigger it from
   * Settings → "Re-ask location permission".
   */
  locationPermissionAsked: boolean;
  /**
   * Last successful IP-geolocation result, used as a fallback when the
   * provider fails. null until the first successful detection. See
   * CachedLocation.
   */
  cachedLocation: CachedLocation | null;
};

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  timeFormat: '24h',
  iconPosition: null,
  moonPhaseSlideEnabled: false,
  themeOverride: 'auto',
  trackWindowPosition: false,
  windowBounds: null,
  onboardingCompleted: false,
  advancedLocationEnabled: false,
  locationOverrides: [],
  browserGeolocation: null,
  locationPermissionAsked: false,
  cachedLocation: null,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnits(v: unknown): v is Units {
  return v === 'metric' || v === 'imperial';
}
function isTimeFormat(v: unknown): v is TimeFormat {
  return v === '12h' || v === '24h';
}
function isThemeOverride(v: unknown): v is ThemeOverride {
  return v === 'auto' || v === 'light' || v === 'dark';
}
function isIconPosition(v: unknown): v is IconPosition {
  return isPlainObject(v) && typeof v.x === 'number' && typeof v.y === 'number';
}
function isWindowBounds(v: unknown): v is WindowBounds {
  return (
    isPlainObject(v) &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  );
}
function isLocationOverride(v: unknown): v is LocationOverride {
  return (
    isPlainObject(v) &&
    typeof v.detectedCity === 'string' &&
    v.detectedCity.length > 0 &&
    typeof v.city === 'string' &&
    typeof v.latitude === 'number' &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === 'number' &&
    Number.isFinite(v.longitude)
  );
}
function isBrowserGeolocation(v: unknown): v is BrowserGeolocation {
  return (
    isPlainObject(v) &&
    typeof v.latitude === 'number' &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === 'number' &&
    Number.isFinite(v.longitude) &&
    typeof v.capturedAt === 'string'
  );
}
function isCachedLocation(v: unknown): v is CachedLocation {
  return (
    isPlainObject(v) &&
    typeof v.latitude === 'number' &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === 'number' &&
    Number.isFinite(v.longitude) &&
    (v.city === null || typeof v.city === 'string')
  );
}

export function mergeWithDefaults(raw: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!isPlainObject(raw)) return out;

  if (isUnits(raw.units)) out.units = raw.units;
  if (isTimeFormat(raw.timeFormat)) out.timeFormat = raw.timeFormat;
  if (raw.iconPosition === null || isIconPosition(raw.iconPosition))
    out.iconPosition = raw.iconPosition;
  if (typeof raw.moonPhaseSlideEnabled === 'boolean')
    out.moonPhaseSlideEnabled = raw.moonPhaseSlideEnabled;
  if (isThemeOverride(raw.themeOverride)) out.themeOverride = raw.themeOverride;
  if (typeof raw.trackWindowPosition === 'boolean')
    out.trackWindowPosition = raw.trackWindowPosition;
  if (raw.windowBounds === null || isWindowBounds(raw.windowBounds))
    out.windowBounds = raw.windowBounds;
  if (typeof raw.onboardingCompleted === 'boolean')
    out.onboardingCompleted = raw.onboardingCompleted;
  if (typeof raw.advancedLocationEnabled === 'boolean')
    out.advancedLocationEnabled = raw.advancedLocationEnabled;
  if (Array.isArray(raw.locationOverrides)) {
    // Drop malformed entries silently rather than rejecting the whole
    // settings file — partial recovery is better than wiping the user's
    // saved cities. Same shape as how iconPosition / windowBounds
    // tolerate corruption above.
    out.locationOverrides = raw.locationOverrides.filter(isLocationOverride);
  }
  if (
    raw.browserGeolocation === null ||
    isBrowserGeolocation(raw.browserGeolocation)
  )
    out.browserGeolocation = raw.browserGeolocation;
  if (typeof raw.locationPermissionAsked === 'boolean')
    out.locationPermissionAsked = raw.locationPermissionAsked;
  if (raw.cachedLocation === null || isCachedLocation(raw.cachedLocation))
    out.cachedLocation = raw.cachedLocation;

  return out;
}

/**
 * Look up the override that applies to a given IP-detected city. Case-
 * insensitive match (so "kelowna" / "Kelowna" / "KELOWNA" are the same
 * key — IP geolocation providers don't always agree on casing).
 *
 * Returns null when no override matches OR when overrides are globally
 * dormant (advancedLocationEnabled === false). The dormant rule lives
 * here so every caller (data store, Settings UI) gets the same answer
 * for "is the override active right now?" without each duplicating
 * the gate.
 */
export function findActiveOverride(
  settings: Settings,
  detectedCity: string | null,
): LocationOverride | null {
  if (!settings.advancedLocationEnabled) return null;
  if (!detectedCity) return null;
  const target = detectedCity.toLowerCase();
  return (
    settings.locationOverrides.find(
      (o) => o.detectedCity.toLowerCase() === target,
    ) ?? null
  );
}

/**
 * Insert or replace the entry for a given detected city. Pure — returns
 * a new array rather than mutating the input. Case-insensitive on the
 * detectedCity comparison so we don't end up with "Kelowna" + "kelowna"
 * as two separate entries.
 */
export function upsertLocationOverride(
  existing: readonly LocationOverride[],
  next: LocationOverride,
): LocationOverride[] {
  const target = next.detectedCity.toLowerCase();
  const filtered = existing.filter(
    (o) => o.detectedCity.toLowerCase() !== target,
  );
  return [...filtered, next];
}

/**
 * Remove the entry for a given detected city. Pure. Case-insensitive.
 */
export function removeLocationOverride(
  existing: readonly LocationOverride[],
  detectedCity: string,
): LocationOverride[] {
  const target = detectedCity.toLowerCase();
  return existing.filter((o) => o.detectedCity.toLowerCase() !== target);
}
