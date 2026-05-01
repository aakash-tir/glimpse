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

function clampToDisplay(
  point: WindowPoint,
  size: { width: number; height: number },
  primary: DisplayBounds,
): WindowPoint {
  const minX = primary.x;
  const maxX = primary.x + primary.width - size.width;
  const minY = primary.y;
  const maxY = primary.y + primary.height - size.height;
  return {
    x: Math.max(minX, Math.min(maxX, point.x)),
    y: Math.max(minY, Math.min(maxY, point.y)),
  };
}

// Window bounds when expanding from a given icon position.
//
// - If the icon sits at the default top-right position, the window
//   opens at the default window position (default size, top-right).
// - Otherwise, the window's center aligns with the icon's center, then
//   clamped to the primary display so the panel stays fully on-screen.
export function expandFromIcon(
  iconPos: IconPosition,
  primary: DisplayBounds,
): WindowBounds {
  const defIcon = defaultIconPosition(primary);
  if (iconPos.x === defIcon.x && iconPos.y === defIcon.y) {
    return defaultWindowBounds(primary);
  }
  const size = defaultWindowSize(primary);
  const cx = iconPos.x + ICON_SIZE / 2;
  const cy = iconPos.y + ICON_SIZE / 2;
  const clamped = clampToDisplay(
    { x: Math.round(cx - size / 2), y: Math.round(cy - size / 2) },
    { width: size, height: size },
    primary,
  );
  return { x: clamped.x, y: clamped.y, width: size, height: size };
}

// Icon position when collapsing the window. Mirrors `expandFromIcon`:
//
// - If the window is at the default window position, the icon snaps
//   back to the default top-right (this is the "special case" in
//   plan/window.md).
// - Otherwise, icon-center aligns with window-center, then clamped to
//   the primary display.
export function collapseTargetFromWindow(
  bounds: WindowBounds,
  primary: DisplayBounds,
): IconPosition {
  if (isWindowAtDefaultPosition(bounds, primary)) {
    return defaultIconPosition(primary);
  }
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const clamped = clampToDisplay(
    { x: Math.round(cx - ICON_SIZE / 2), y: Math.round(cy - ICON_SIZE / 2) },
    { width: ICON_SIZE, height: ICON_SIZE },
    primary,
  );
  return clamped;
}

// Snap a dropped window to the nearest screen corner if within the snap
// radius. Unlike the icon's snap, the window has no padding — corner
// snap means the window's edge sits flush against the screen edge.
// Returns null when no corner is close enough (drop landed near an
// edge midpoint, the screen center, or anywhere else).
export function snapWindowToCorner(
  topLeft: WindowPoint,
  size: { width: number; height: number },
  primary: DisplayBounds,
  radiusPx: number = WINDOW_SNAP_RADIUS_PX,
): WindowCornerSnap | null {
  const left = primary.x;
  const right = primary.x + primary.width - size.width;
  const top = primary.y;
  const bottom = primary.y + primary.height - size.height;

  const corners: WindowCornerSnap[] = [
    { corner: 'top-left', position: { x: left, y: top } },
    { corner: 'top-right', position: { x: right, y: top } },
    { corner: 'bottom-left', position: { x: left, y: bottom } },
    { corner: 'bottom-right', position: { x: right, y: bottom } },
  ];

  let best: { entry: WindowCornerSnap; dist: number } | null = null;
  for (const entry of corners) {
    const dx = entry.position.x - topLeft.x;
    const dy = entry.position.y - topLeft.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radiusPx) continue;
    if (best === null || dist < best.dist) best = { entry, dist };
  }
  return best?.entry ?? null;
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
