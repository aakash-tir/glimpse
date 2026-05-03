// Aurora visibility filter and accompanying user-aware text.
// See plan/data-sources.md § "Aurora visibility filter".
//
// Threshold table (absolute latitude → minimum Kp for local visibility):
//   ≥ 60°         → Kp ≥ 4
//   50° – 60°     → Kp ≥ 5
//   40° – 50°     → Kp ≥ 6
//   < 40°         → Kp ≥ 7
//
// Higher latitudes see aurora at lower Kp; the lookup uses the user's
// absolute latitude so southern-hemisphere users behave the same as
// northern-hemisphere users at the matching distance from the equator.

export type AuroraInput = {
  latitude: number;
  kp: number;
};

export type AuroraVisibility = {
  // True when the slide-visibility filter (M5) says aurora is visible
  // from this exact location and the slide should be shown. Drives the
  // events-slide inclusion list.
  visibleFromUserLocation: boolean;
  // User-aware text for the slide body (consumed in M8). Always
  // populated so the slide doesn't have to handle null.
  text: string;
};

export function thresholdForLatitude(absLatitude: number): number {
  if (absLatitude >= 60) return 4;
  if (absLatitude >= 50) return 5;
  if (absLatitude >= 40) return 6;
  return 7;
}

// Lowest latitude band where the given Kp meets the threshold — i.e.
// where in the world someone could currently see aurora. Used to fill
// in the "Visible at latitudes ≥ Nº" text when the user's own location
// doesn't qualify. Returns null if Kp is below every band's threshold.
function lowestVisibleLatitude(kp: number): number | null {
  if (kp >= 7) return 40; // <40° threshold met → visible from ~anywhere
  if (kp >= 6) return 40;
  if (kp >= 5) return 50;
  if (kp >= 4) return 60;
  return null;
}

export function evaluateAuroraVisibility(input: AuroraInput): AuroraVisibility {
  const absLat = Math.abs(input.latitude);
  const userThreshold = thresholdForLatitude(absLat);
  const visibleFromUser = input.kp >= userThreshold;
  if (visibleFromUser) {
    return {
      visibleFromUserLocation: true,
      text: 'Visible from your location',
    };
  }
  const nextBandLat = lowestVisibleLatitude(input.kp);
  return {
    visibleFromUserLocation: false,
    text:
      nextBandLat === null
        ? 'Not currently visible'
        : `Visible at latitudes ≥ ${nextBandLat}°`,
  };
}
