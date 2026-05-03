// Pure window-mode geometry. Mirrors `icon-position.ts` for the expanded
// weather panel: default size, default position, expand-from-icon,
// collapse-to-icon, and square-lock corner resize math. No DOM, no
// Electron — these helpers are unit-testable in isolation.
//
// Per plan/window.md:
//   - Default size: 1/6 of the primary monitor's smallest dimension (square).
//   - Resizable by 4 corner handles only; width = height; min 120; max =
//     min(displayW, displayH) - margin.
//   - Window position persistence is opt-in (the "Track window position"
//     setting). When *off*, every expand uses the default size at the
//     icon's current location.
//   - On collapse, the icon's resting position is the window's center
//     mapped to the icon's center, clamped to the primary display.
//     Special case: if the window was at the default window position
//     when collapsed, the icon snaps to the default top-right padded
//     position instead.

import type { IconPosition, WindowBounds } from './settings-store';
import {
  defaultIconPosition,
  displayForIcon,
  displayForPoint,
  ICON_PADDING,
  ICON_SIZE,
  type DisplayBounds,
} from './icon-position';
import type { Corner } from './snap';

// 1/6 of the primary monitor's smallest dimension.
export const WINDOW_DEFAULT_SIZE_DENOM = 6;
// Plan: "max size: smaller of (display width, display height) minus a
// small margin." 16 px matches the icon's edge padding so the window
// can't visually butt up against the very edge of the screen.
export const WINDOW_MAX_MARGIN_PX = 16;
export const WINDOW_MIN_SIZE_PX = 120;
// Same threshold as the icon corner snap (40 px). Per plan/window.md:
// "Window drag bounds: same as the icon — free placement on primary
// monitor + snap to the 4 screen corners with 40 px radius. (Snap
// padding does not apply to the window itself, only to the icon's
// resting position.)"
export const WINDOW_SNAP_RADIUS_PX = 40;

export type WindowPoint = { x: number; y: number };

export type ResizeCorner =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type WindowCornerSnap = { corner: Corner; position: WindowPoint };

export function defaultWindowSize(primary: DisplayBounds): number {
  return Math.floor(
    Math.min(primary.width, primary.height) / WINDOW_DEFAULT_SIZE_DENOM,
  );
}

// Largest size the user can resize to. Clamped against the min so the
// returned range is always valid even on extremely small displays.
export function maxWindowSize(primary: DisplayBounds): number {
  const cap = Math.min(primary.width, primary.height) - WINDOW_MAX_MARGIN_PX;
  return Math.max(WINDOW_MIN_SIZE_PX, cap);
}

// Default window position mirrors the default *icon* position: top-right
// of the primary display with the same 16 px padding. This is what makes
// the "default icon → default window" round-trip clean.
export function defaultWindowPosition(primary: DisplayBounds): WindowPoint {
  const size = defaultWindowSize(primary);
  return {
    x: primary.x + primary.width - size - ICON_PADDING,
    y: primary.y + ICON_PADDING,
  };
}

export function defaultWindowBounds(primary: DisplayBounds): WindowBounds {
  const size = defaultWindowSize(primary);
  const pos = defaultWindowPosition(primary);
  return { x: pos.x, y: pos.y, width: size, height: size };
}

// Equality check used by the collapse-to-icon "snap back to default
// top-right" special case. Compares against the *current* default
// (display-relative) so resolution / monitor changes don't strand the
// user with a window that no longer counts as default.
export function isWindowAtDefaultPosition(
  bounds: WindowBounds,
  primary: DisplayBounds,
): boolean {
  const def = defaultWindowBounds(primary);
  return (
    bounds.x === def.x &&
    bounds.y === def.y &&
    bounds.width === def.width &&
    bounds.height === def.height
  );
}

// Clamp a window's top-left so the entire window rectangle fits within
// the given display. Used both for the expand-from-icon math (window
// can't be born off-screen) and as the building block for
// clampWindowForDrag below.
export function clampWindowToDisplay(
  point: WindowPoint,
  size: { width: number; height: number },
  display: DisplayBounds,
): WindowPoint {
  const minX = display.x;
  const maxX = display.x + display.width - size.width;
  const minY = display.y;
  const maxY = display.y + display.height - size.height;
  return {
    x: Math.max(minX, Math.min(maxX, point.x)),
    y: Math.max(minY, Math.min(maxY, point.y)),
  };
}

// True iff the window rectangle (top-left = pos, given size) fits
// fully within the given display.
function fitsOnDisplay(
  pos: WindowPoint,
  size: { width: number; height: number },
  d: DisplayBounds,
): boolean {
  return (
    pos.x >= d.x &&
    pos.y >= d.y &&
    pos.x + size.width <= d.x + d.width &&
    pos.y + size.height <= d.y + d.height
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

// Cross-display drag clamp for the window. Direct mirror of
// clampIconForDrag in icon-position.ts (same docstring intent —
// keep the algorithms in lockstep).
//
// Single-display: behaves like clampWindowToDisplay against the
// cursor's display — the window hugs the edges as the cursor
// approaches them, so the user can't drag the panel off-screen.
//
// Multi-display: as the cursor crosses from display A to display B,
// the window stays hugging A's edge until the cursor has moved far
// enough into B that the window would fit fully on B at its current
// drag offset. Only then does the window "jump" onto B. This avoids
// flickering between displays in the seam region where the offset
// would put the window partially off either display.
export function clampWindowForDrag(args: {
  candidate: WindowPoint;
  size: { width: number; height: number };
  cursor: { x: number; y: number };
  prevPos: WindowPoint;
  allDisplays: DisplayBounds[];
}): WindowPoint {
  const { candidate, size, cursor, prevPos, allDisplays } = args;
  if (allDisplays.length === 0) return prevPos;

  const cursorDisplay = displayContaining(cursor, allDisplays);
  if (cursorDisplay && fitsOnDisplay(candidate, size, cursorDisplay)) {
    return candidate;
  }

  // Candidate doesn't fit on the cursor's display (or the cursor is in
  // a gap). Hold the window on whichever display it was last on,
  // hugging that display's edge in the cursor's direction.
  const fallback =
    displayContaining(
      { x: prevPos.x + size.width / 2, y: prevPos.y + size.height / 2 },
      allDisplays,
    ) ?? allDisplays[0];
  return clampWindowToDisplay(candidate, size, fallback);
}

// Window bounds when expanding from a given icon position.
//
// - If the icon sits at the canonical default top-right position AND
//   no sizeOverride is given (the user hasn't resized this session),
//   the window opens at the canonical default window bounds.
//   Preserves the default-icon ↔ default-window round-trip rule.
// - Otherwise, the window's center aligns with the icon's center,
//   then clamped to the icon's display (multi-monitor aware).
//
// `sizeOverride` carries the in-session size persistence: once the
// user resizes, the next collapse-then-expand reuses that size at
// the icon's location instead of falling back to default. Disk
// persistence is still gated by trackWindowPosition (handled in
// resolveWindowBoundsForExpand). Default size always comes from
// primary so the panel size is consistent regardless of which
// display the icon is on.
export function expandFromIcon(
  iconPos: IconPosition,
  primary: DisplayBounds,
  allDisplays: DisplayBounds[] = [primary],
  sizeOverride?: number,
): WindowBounds {
  const defIcon = defaultIconPosition(primary);
  if (
    sizeOverride === undefined &&
    iconPos.x === defIcon.x &&
    iconPos.y === defIcon.y
  ) {
    return defaultWindowBounds(primary);
  }
  const size = sizeOverride ?? defaultWindowSize(primary);
  const cx = iconPos.x + ICON_SIZE / 2;
  const cy = iconPos.y + ICON_SIZE / 2;
  const display = displayForIcon(iconPos, allDisplays, primary);
  const clamped = clampWindowToDisplay(
    { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2) },
    { width: size, height: size },
    display,
  );
  return { x: clamped.x, y: clamped.y, width: size, height: size };
}

// Icon position when collapsing the window. Mirrors `expandFromIcon`:
//
// - If the window is at the canonical default window position
//   (primary's top-right), the icon snaps back to the canonical
//   default top-right (the "special case" in plan/window.md).
// - Otherwise, icon-center aligns with window-center, then clamped
//   to whichever display the window's center is on. Multi-monitor:
//   a window on the secondary monitor collapses to an icon on the
//   secondary, NOT yanked back to primary.
export function collapseTargetFromWindow(
  bounds: WindowBounds,
  primary: DisplayBounds,
  allDisplays: DisplayBounds[] = [primary],
): IconPosition {
  if (isWindowAtDefaultPosition(bounds, primary)) {
    return defaultIconPosition(primary);
  }
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const display = displayForPoint({ x: cx, y: cy }, allDisplays, primary);
  const clamped = clampWindowToDisplay(
    { x: Math.round(cx - ICON_SIZE / 2), y: Math.round(cy - ICON_SIZE / 2) },
    { width: ICON_SIZE, height: ICON_SIZE },
    display,
  );
  return clamped;
}

// True iff the window rectangle is fully contained within the union of
// the supplied display rectangles. A monitor disconnect / resolution
// change can leave a tracked windowBounds entry off-screen; the caller
// should fall back to the default expand-from-icon behavior in that
// case.
export function isWindowBoundsOnScreen(
  bounds: WindowBounds,
  displays: DisplayBounds[],
): boolean {
  if (displays.length === 0) return false;
  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return displays.some(
    (d) =>
      left >= d.x &&
      top >= d.y &&
      right <= d.x + d.width &&
      bottom <= d.y + d.height,
  );
}

// Resolves the window bounds to use on expand. Encodes the
// trackWindowPosition contract:
//   - off (default): every expand uses default size at the icon's
//     current screen location (via expandFromIcon).
//   - on + saved bounds on-screen: restore the saved bounds.
//   - on + saved bounds off-screen (monitor change): fall back to
//     the default behavior so the user isn't stuck with an invisible
//     window.
export function resolveWindowBoundsForExpand(args: {
  iconPos: IconPosition;
  primary: DisplayBounds;
  trackWindowPosition: boolean;
  savedBounds: WindowBounds | null;
  allDisplays: DisplayBounds[];
  // In-session size persistence: if the user resized the window
  // earlier this session, the next expand reuses that size at the
  // icon's location (even with trackWindowPosition off). Disk
  // persistence is still gated by trackWindowPosition.
  sessionSize?: number;
}): WindowBounds {
  if (
    args.trackWindowPosition &&
    args.savedBounds &&
    isWindowBoundsOnScreen(args.savedBounds, args.allDisplays)
  ) {
    return args.savedBounds;
  }
  return expandFromIcon(
    args.iconPos,
    args.primary,
    args.allDisplays,
    args.sessionSize,
  );
}

// Snap-target corner positions for one display, given a window size.
// Window has no padding — corner snap means the window's edge sits
// flush against the display edge.
function windowCornersForDisplay(
  display: DisplayBounds,
  size: { width: number; height: number },
): WindowCornerSnap[] {
  const left = display.x;
  const right = display.x + display.width - size.width;
  const top = display.y;
  const bottom = display.y + display.height - size.height;
  return [
    { corner: 'top-left', position: { x: left, y: top } },
    { corner: 'top-right', position: { x: right, y: top } },
    { corner: 'bottom-left', position: { x: left, y: bottom } },
    { corner: 'bottom-right', position: { x: right, y: bottom } },
  ];
}

// Snap a dropped window to the nearest screen corner across any
// connected display, if within the snap radius. Multi-monitor: a drop
// near the secondary display's bottom-left corner snaps flush against
// THAT display's bottom-left, not the primary's. Returns null when no
// corner on any display is close enough.
export function snapWindowToCorner(
  topLeft: WindowPoint,
  size: { width: number; height: number },
  displays: DisplayBounds[],
  radiusPx: number = WINDOW_SNAP_RADIUS_PX,
): WindowCornerSnap | null {
  let best: { entry: WindowCornerSnap; dist: number } | null = null;
  for (const display of displays) {
    for (const entry of windowCornersForDisplay(display, size)) {
      const dx = entry.position.x - topLeft.x;
      const dy = entry.position.y - topLeft.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radiusPx) continue;
      if (best === null || dist < best.dist) best = { entry, dist };
    }
  }
  return best?.entry ?? null;
}

// Largest size the window can be resized to without spilling off the
// display containing the diagonal-fixed corner. The fixed corner
// stays put, so the new bounds extend from there toward the dragged
// corner; the cap is the smaller of (room from fixed corner to
// display edge in X, same in Y).
//
// This is the per-display companion to maxWindowSize (which only
// caps against the primary display's overall dimensions). Callers
// pass min(maxWindowSize, maxSizeForResize) to squareResize.
export function maxSizeForResize(args: {
  corner: ResizeCorner;
  origin: WindowBounds;
  display: DisplayBounds;
}): number {
  const { corner, origin, display } = args;
  let maxW: number;
  let maxH: number;
  switch (corner) {
    case 'bottom-right':
      // Fixed at top-left = (origin.x, origin.y).
      maxW = display.x + display.width - origin.x;
      maxH = display.y + display.height - origin.y;
      break;
    case 'bottom-left':
      // Fixed at top-right = (origin.x + origin.width, origin.y).
      maxW = origin.x + origin.width - display.x;
      maxH = display.y + display.height - origin.y;
      break;
    case 'top-right':
      // Fixed at bottom-left = (origin.x, origin.y + origin.height).
      maxW = display.x + display.width - origin.x;
      maxH = origin.y + origin.height - display.y;
      break;
    case 'top-left':
      // Fixed at bottom-right = (origin.x + origin.width,
      //                          origin.y + origin.height).
      maxW = origin.x + origin.width - display.x;
      maxH = origin.y + origin.height - display.y;
      break;
  }
  return Math.max(0, Math.min(maxW, maxH));
}

// Square-lock corner resize. The diagonal-opposite corner stays fixed;
// the dragged corner is the only one that moves. The new size is the
// per-corner "outward" component of the cursor delta — whichever of dx
// or dy moves outward most controls the side length, so dragging
// purely along one axis still grows the square.
//
// `cursorDx` / `cursorDy` are total cursor movement in screen pixels
// since drag start (positive = right / down).
export function squareResize(args: {
  origin: WindowBounds;
  corner: ResizeCorner;
  cursorDx: number;
  cursorDy: number;
  minSize: number;
  maxSize: number;
}): WindowBounds {
  const { origin, corner, cursorDx, cursorDy, minSize, maxSize } = args;

  // For each corner, "outward" is along a specific sign of dx and dy.
  // The size delta is whichever outward component is larger.
  let outwardDx: number;
  let outwardDy: number;
  switch (corner) {
    case 'bottom-right':
      outwardDx = cursorDx;
      outwardDy = cursorDy;
      break;
    case 'bottom-left':
      outwardDx = -cursorDx;
      outwardDy = cursorDy;
      break;
    case 'top-right':
      outwardDx = cursorDx;
      outwardDy = -cursorDy;
      break;
    case 'top-left':
      outwardDx = -cursorDx;
      outwardDy = -cursorDy;
      break;
  }
  const sizeDelta = Math.max(outwardDx, outwardDy);
  const rawSize = origin.width + sizeDelta;
  const size = Math.round(Math.max(minSize, Math.min(maxSize, rawSize)));

  // Place the new bounds so the diagonal-opposite corner stays fixed.
  switch (corner) {
    case 'bottom-right':
      return { x: origin.x, y: origin.y, width: size, height: size };
    case 'bottom-left':
      return {
        x: origin.x + origin.width - size,
        y: origin.y,
        width: size,
        height: size,
      };
    case 'top-right':
      return {
        x: origin.x,
        y: origin.y + origin.height - size,
        width: size,
        height: size,
      };
    case 'top-left':
      return {
        x: origin.x + origin.width - size,
        y: origin.y + origin.height - size,
        width: size,
        height: size,
      };
  }
}
