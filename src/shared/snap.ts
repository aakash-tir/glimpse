// Snap-to-corner logic for the icon when dropped at the end of a drag.
//
// Per plan/icon.md: "when dropped within 40 px of any of the 4 screen
// corners, the icon snaps to that corner with the same 16 px padding
// preserved. Edges and centers do not snap." We measure the drop's
// distance from each corner's snapped icon position (not from the screen
// corner itself), so the threshold describes how close the user needs to
// release to commit the snap.

import type { IconPosition } from './settings-store';
import { ICON_PADDING, ICON_SIZE, type DisplayBounds } from './icon-position';

export const SNAP_RADIUS_PX = 40;

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type CornerPosition = {
  corner: Corner;
  position: IconPosition;
};

// The four icon top-left positions corresponding to each corner with the
// 16 px padding preserved.
export function cornerPositions(primary: DisplayBounds): CornerPosition[] {
  const left = primary.x + ICON_PADDING;
  const right = primary.x + primary.width - ICON_SIZE - ICON_PADDING;
  const top = primary.y + ICON_PADDING;
  const bottom = primary.y + primary.height - ICON_SIZE - ICON_PADDING;

  return [
    { corner: 'top-left', position: { x: left, y: top } },
    { corner: 'top-right', position: { x: right, y: top } },
    { corner: 'bottom-left', position: { x: left, y: bottom } },
    { corner: 'bottom-right', position: { x: right, y: bottom } },
  ];
}

function distance(a: IconPosition, b: IconPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Returns the closest corner whose snapped position is within the snap
// radius of the dropped icon position. Returns null if no corner is close
// enough (i.e. drop landed near an edge midpoint, the screen center, or
// anywhere else off-corner).
export function snapToCorner(
  dropped: IconPosition,
  primary: DisplayBounds,
  radiusPx: number = SNAP_RADIUS_PX,
): CornerPosition | null {
  let best: { entry: CornerPosition; dist: number } | null = null;
  for (const entry of cornerPositions(primary)) {
    const d = distance(dropped, entry.position);
    if (d > radiusPx) continue;
    if (best === null || d < best.dist) best = { entry, dist: d };
  }
  return best?.entry ?? null;
}
