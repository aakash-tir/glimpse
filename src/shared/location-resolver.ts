// Decides which coordinates the data-store should fetch the forecast
// with, given the IP-detected location and the current settings. Pure
// function — kept in shared/ so the data-store and any future renderer
// previews use the exact same priority rules.
//
// Priority (highest first):
//   1. Active manual override matching the IP-detected city (per
//      findActiveOverride: gated by advancedLocationEnabled). This is
//      the user's strongest signal — they've explicitly told us where
//      they are.
//   2. Cached browser geolocation. More accurate than IP for typical
//      Wi-Fi-equipped devices, requires user permission once.
//   3. IP-detected coordinates from the geolocation provider. Always
//      available; the rest of the system already worked with this
//      before any of this priority logic landed.

import { findActiveOverride, type Settings } from './settings-store';

/** Minimal shape of the IP-detected location consumed by the resolver. */
export type DetectedLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
};

export type ResolvedCoords = {
  latitude: number;
  longitude: number;
  /** Display city. User-entered when an override is active, IP city otherwise. */
  displayCity: string | null;
  source: 'override' | 'browser' | 'ip';
};

export function resolveCoords(
  detected: DetectedLocation,
  settings: Settings,
): ResolvedCoords {
  const override = findActiveOverride(settings, detected.city);
  if (override) {
    return {
      latitude: override.latitude,
      longitude: override.longitude,
      displayCity: override.city,
      source: 'override',
    };
  }
  if (settings.browserGeolocation) {
    return {
      latitude: settings.browserGeolocation.latitude,
      longitude: settings.browserGeolocation.longitude,
      // Browser geolocation gives us coords but no city — the IP city
      // is still the closest label we have, so reuse it for display.
      displayCity: detected.city,
      source: 'browser',
    };
  }
  return {
    latitude: detected.latitude,
    longitude: detected.longitude,
    displayCity: detected.city,
    source: 'ip',
  };
}
