import type { IconPosition } from './settings-store';

export const ICON_SIZE = 64;
export const ICON_PADDING = 16;

export type DisplayBounds = { x: number; y: number; width: number; height: number };

export function defaultIconPosition(primary: DisplayBounds): IconPosition {
  return {
    x: primary.x + primary.width - ICON_SIZE - ICON_PADDING,
    y: primary.y + ICON_PADDING,
  };
}

// True iff the saved icon rectangle is fully contained within the union of
// the supplied display rectangles. Off-screen → caller should fall back to
// the default top-right position on the primary display.
export function isPositionOnScreen(pos: IconPosition, displays: DisplayBounds[]): boolean {
  if (displays.length === 0) return false;
  const left = pos.x;
  const top = pos.y;
  const right = pos.x + ICON_SIZE;
  const bottom = pos.y + ICON_SIZE;

  return displays.some(
    (d) =>
      left >= d.x &&
      top >= d.y &&
      right <= d.x + d.width &&
      bottom <= d.y + d.height,
  );
}

export function resolveIconPosition(
  saved: IconPosition | null,
  primary: DisplayBounds,
  allDisplays: DisplayBounds[],
): IconPosition {
  if (saved && isPositionOnScreen(saved, allDisplays)) return saved;
  return defaultIconPosition(primary);
}
