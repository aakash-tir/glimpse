// Geometry helpers for the first-launch onboarding panel. Pure — no
// Electron imports — so both the main process (window sizing) and the
// renderer / tests can share them. See plan/onboarding.md § Rendering
// surface: a square panel ~half the work-area height, anchored
// top-right with the standard margin.

import type { DisplayBounds } from './icon-position';

export const ONBOARDING_MARGIN_PX = 16;
/** Floor so the panel is usable even on very short displays. */
export const ONBOARDING_MIN_SIDE_PX = 320;

export type OnboardingBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Bounds for the onboarding panel: a square whose side is ~half the
 * work-area height, clamped to fit within the work area (minus margins)
 * and to a sane minimum, anchored at the top-right corner.
 */
export function onboardingWindowBounds(
  workArea: DisplayBounds,
): OnboardingBounds {
  const maxSide = Math.min(
    workArea.width - ONBOARDING_MARGIN_PX * 2,
    workArea.height - ONBOARDING_MARGIN_PX * 2,
  );
  const side = Math.max(
    ONBOARDING_MIN_SIDE_PX,
    Math.min(Math.round(workArea.height / 2), maxSide),
  );
  return {
    x: workArea.x + workArea.width - side - ONBOARDING_MARGIN_PX,
    y: workArea.y + ONBOARDING_MARGIN_PX,
    width: side,
    height: side,
  };
}

/** A rectangle inside the onboarding panel (px, panel-local coords). */
export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CalloutPlacement = 'above' | 'below' | 'center';

/**
 * Where the callout bubble sits relative to the spotlit element:
 * below when the element is in the top half (more room beneath),
 * above when it's in the bottom half, and centered when there's no
 * spotlight (e.g. the welcome step).
 */
export function calloutPlacement(
  spotlight: SpotlightRect | null,
  panelHeight: number,
): CalloutPlacement {
  if (!spotlight) return 'center';
  const mid = spotlight.y + spotlight.height / 2;
  return mid < panelHeight / 2 ? 'below' : 'above';
}
