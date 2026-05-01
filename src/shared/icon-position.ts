import type { IconPosition } from './settings-store';

// The visible weather glyph is ICON_SIZE x ICON_SIZE.
export const ICON_SIZE = 64;
export const ICON_PADDING = 16;

// The Electron window is larger than the icon so tooltips and (future)
// drag glow have room to render outside the icon's bounds. The window
// stays transparent; only the icon glyph + tooltip are visible.
export const WINDOW_WIDTH = 260;
export const WINDOW_HEIGHT = 100;

// Where the icon sits inside the window (top-right with ICON_PADDING).
export const ICON_OFFSET_X = WINDOW_WIDTH - ICON_PADDING - ICON_SIZE;
export const ICON_OFFSET_Y = ICON_PADDING;

export type DisplayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// IconPosition stores the icon's visible top-left in screen coordinates.
// The window is positioned at iconPos - (ICON_OFFSET_X, ICON_OFFSET_Y).
export function defaultIconPosition(primary: DisplayBounds): IconPosition {
  return {
    x: primary.x + primary.width - ICON_SIZE - ICON_PADDING,
    y: primary.y + ICON_PADDING,
  };
}

export function windowPositionForIcon(iconPos: IconPosition): {
  x: number;
  y: number;
} {
  return {
    x: iconPos.x - ICON_OFFSET_X,
    y: iconPos.y - ICON_OFFSET_Y,
  };
}

// True iff the saved icon rectangle is fully contained within the union of
// the supplied display rectangles. Off-screen → caller should fall back to
// the default top-right position on the primary display.
export function isPositionOnScreen(
  pos: IconPosition,
  displays: DisplayBounds[],
): boolean {
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
