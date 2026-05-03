// Snap-to-corner logic for the icon when dropped at the end of a drag.
//
// Per plan/icon.md: "when dropped within 40 px of any of the 4 screen
// corners, the icon snaps to that corner with the same 16 px padding
// preserved. Edges and centers do not snap." We measure the drop's
// distance from each corner's snapped icon position (not from the screen
// corner itself), so the threshold describes how close the user needs to
// release to commit the snap.
//
// Multi-monitor: the snap considers the corners of every connected
// display. Drop near the secondary monitor's bottom-right corner ->
// snaps to that corner with the same 16 px padding rule, just on the
// secondary display.

import type { IconPosition } from './settings-store';
import { ICON_PADDING, ICON_SIZE, type DisplayBounds } from './icon-position';

export const SNAP_RADIUS_PX = 40;

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type CornerPosition = {
  corner: Corner;
  position: IconPosition;
};

// The four icon top-left positions for one display's corners, with the
// 16 px padding preserved.
function cornersForDisplay(display: DisplayBounds): CornerPosition[] {
  const left = display.x + ICON_PADDING;
  const right = display.x + display.width - ICON_SIZE - ICON_PADDING;
  const top = display.y + ICON_PADDING;
  const bottom = display.y + display.height - ICON_SIZE - ICON_PADDING;

  return [
    { corner: 'top-left', position: { x: left, y: top } },
    { corner: 'top-right', position: { x: right, y: top } },
    { corner: 'bottom-left', position: { x: left, y: bottom } },
    { corner: 'bottom-right', position: { x: right, y: bottom } },
  ];
}

// All snap-target corners across every connected display (4 × N).
export function cornerPositions(displays: DisplayBounds[]): CornerPosition[] {
  return displays.flatMap(cornersForDisplay);
}

function distance(a: IconPosition, b: IconPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns the closest corner across all displays whose snapped position
// is within the snap radius of the dropped icon position. Returns null
// if no corner on any display is close enough (drop landed near an edge
// midpoint, a display center, or anywhere else off-corner).
export function snapToCorner(
  dropped: IconPosition,
  displays: DisplayBounds[],
  radiusPx: number = SNAP_RADIUS_PX,
): CornerPosition | null {
  let best: { entry: CornerPosition; dist: number } | null = null;
  for (const entry of cornerPositions(displays)) {
    const d = distance(dropped, entry.position);
    if (d > radiusPx) continue;
    if (best === null || d < best.dist) best = { entry, dist: d };
  }
  return best?.entry ?? null;
}
