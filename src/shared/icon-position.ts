import type { IconPosition } from './settings-store';

// The visible weather glyph is ICON_SIZE x ICON_SIZE.
export const ICON_SIZE = 64;
export const ICON_PADDING = 16;

// The Electron window is larger than the icon so tooltips and (future)
// drag glow have room to render outside the icon's bounds. The window
// stays transparent; only the icon glyph + tooltip are visible.
export const WINDOW_WIDTH = 260;
// Sized to: top padding (16) + icon (64) + 0px gap + ~25px tooltip + 7px
// breathing = 112. Top + right padding stay at 16; bottom is intentionally
// snug so the transparent window doesn't claim more screen real estate
// than the visible content needs.
export const WINDOW_HEIGHT = 112;

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

// Clamp an icon position so it sits fully inside the given display.
// Used on collapse when the icon's drift-free target may have been
// pushed off-screen by a display change while the panel was open.
export function clampIconToDisplay(
  pos: IconPosition,
  primary: DisplayBounds,
): IconPosition {
  const minX = primary.x;
  const maxX = primary.x + primary.width - ICON_SIZE;
  const minY = primary.y;
  const maxY = primary.y + primary.height - ICON_SIZE;
  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  };
}

// True iff the icon (top-left = pos, ICON_SIZE square) fits fully
// within the given display.
function fitsOnDisplay(pos: IconPosition, d: DisplayBounds): boolean {
  return (
    pos.x >= d.x &&
    pos.y >= d.y &&
    pos.x + ICON_SIZE <= d.x + d.width &&
    pos.y + ICON_SIZE <= d.y + d.height
  );
}

// Returns the display containing the cursor, or null if the cursor
// isn't on any connected display (rare — happens transiently when
// the cursor is in a gap between displays).
function displayContaining(
  point: { x: number; y: number },
  displays: DisplayBounds[],
): DisplayBounds | null {
  return (
    displays.find(
      (d) =>
        point.x >= d.x &&
        point.y >= d.y &&
        point.x < d.x + d.width &&
        point.y < d.y + d.height,
    ) ?? null
  );
}

// Cross-display drag clamp.
//
// Single-display: behaves like clampIconToDisplay against the cursor's
// display — the icon hugs the edges as the cursor approaches them.
//
// Multi-display: as the cursor crosses from display A to display B, the
// icon stays hugging A's edge until the cursor has moved far enough into
// B that the icon would fit fully on B at the cursor's drag offset. Only
// then does the icon "jump" onto B. This avoids the icon flickering
// between displays in the seam region where the offset would put it
// partially off either display.
export function clampIconForDrag(args: {
  candidate: IconPosition;
  cursor: { x: number; y: number };
  prevPos: IconPosition;
  allDisplays: DisplayBounds[];
}): IconPosition {
  const { candidate, cursor, prevPos, allDisplays } = args;
  if (allDisplays.length === 0) return prevPos;

  const cursorDisplay = displayContaining(cursor, allDisplays);
  if (cursorDisplay && fitsOnDisplay(candidate, cursorDisplay)) {
    return candidate;
  }

  // Candidate doesn't fit on the cursor's display (or the cursor is in
  // a gap). Hold the icon on whichever display it was last on, hugging
  // that display's edge in the cursor's direction.
  const fallback =
    displayContaining(
      { x: prevPos.x + ICON_SIZE / 2, y: prevPos.y + ICON_SIZE / 2 },
      allDisplays,
    ) ?? allDisplays[0];
  return clampIconToDisplay(candidate, fallback);
}

// True iff a previously-saved position can no longer be honored on the
// current display layout (monitor disconnected, resolution shrunk, primary
// monitor swapped to a smaller one). The caller should fall back to the
// default top-right and clear the saved position.
export function shouldResetIconPosition(
  saved: IconPosition | null,
  allDisplays: DisplayBounds[],
): boolean {
  if (saved === null) return false;
  return !isPositionOnScreen(saved, allDisplays);
}
