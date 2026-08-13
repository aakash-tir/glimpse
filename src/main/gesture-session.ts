// Drag and resize session state machine.
//
// Extracted from main/index.ts in M11. It was the most stateful part of
// that module and the only place a real geometry bug has ever shipped
// (the M3 edge-snap clamp, which survived until an Electron upgrade
// exposed it) — and it was reachable only through Playwright, because
// index.ts touches Electron at import time.
//
// The controller owns the session state and does the geometry through
// the pure helpers in shared/. It never touches Electron: callers pass
// the display layout and the window's current bounds in, and get an
// *intent* back describing what to apply. index.ts stays responsible
// for setBounds / saveSettings / the lastWindowBounds bookkeeping.
// That keeps this file unit-testable with plain objects.

import {
  clampIconForDrag,
  displayForPoint,
  type DisplayBounds,
} from '../shared/icon-position';
import { snapToCorner } from '../shared/snap';
import type { IconPosition, WindowBounds } from '../shared/settings-store';
import {
  clampWindowForDrag,
  maxSizeForResize,
  maxWindowSize,
  snapWindowToCorner,
  snapWindowToEdge,
  squareResize,
  WINDOW_MIN_SIZE_PX,
  type ResizeCorner,
  type WindowPoint,
} from '../shared/window-position';
import { computeIconPosFromCursor, type ScreenPoint } from '../shared/drag';

export type { ScreenPoint };

export type DragSubject = 'icon' | 'window';

type DragSession =
  | {
      subject: 'icon';
      startCursor: ScreenPoint;
      startPos: IconPosition;
    }
  | {
      subject: 'window';
      startCursor: ScreenPoint;
      startPos: WindowPoint;
      // Captured ONCE at drag:start. move/end reuse it rather than
      // re-reading getBounds(), which on Windows drifts by the DWM
      // frame correction on read-back.
      startSize: { width: number; height: number };
      // Where the window's top-left actually landed after the most
      // recent tick — clampWindowForDrag uses it to decide which
      // display the window is anchored to across a monitor seam.
      lastAppliedPos: WindowPoint;
    };

type ResizeSession = {
  corner: ResizeCorner;
  startCursor: ScreenPoint;
  origin: WindowBounds;
};

/** What the caller should apply after a drag tick. */
export type DragMove =
  | { subject: 'window'; bounds: WindowBounds }
  | { subject: 'icon'; position: IconPosition };

/** What the caller should apply and persist when a drag completes. */
export type DragEnd =
  | {
      subject: 'window';
      bounds: WindowBounds;
      /** Marks that a real window drag happened — drives collapse case B3. */
      windowDragged: true;
    }
  | {
      subject: 'icon';
      position: IconPosition;
      /** Icon position is always persisted on drop. */
      persist: true;
    };

export type GeometryContext = {
  allDisplays: DisplayBounds[];
  primary: DisplayBounds;
};

export class GestureController {
  private drag: DragSession | null = null;
  private resize: ResizeSession | null = null;

  get isDragging(): boolean {
    return this.drag !== null;
  }

  get isResizing(): boolean {
    return this.resize !== null;
  }

  /** Drop any in-flight gesture — used when the window is destroyed. */
  reset(): void {
    this.drag = null;
    this.resize = null;
  }

  // ---------------------------------------------------------------
  // Drag
  // ---------------------------------------------------------------

  startWindowDrag(cursor: ScreenPoint, bounds: WindowBounds): void {
    this.drag = {
      subject: 'window',
      startCursor: cursor,
      startPos: { x: bounds.x, y: bounds.y },
      startSize: { width: bounds.width, height: bounds.height },
      lastAppliedPos: { x: bounds.x, y: bounds.y },
    };
  }

  startIconDrag(cursor: ScreenPoint, iconPos: IconPosition): void {
    this.drag = {
      subject: 'icon',
      startCursor: cursor,
      startPos: iconPos,
    };
  }

  moveDrag(
    cursor: ScreenPoint,
    ctx: GeometryContext,
    currentIconPos: IconPosition,
  ): DragMove | null {
    const session = this.drag;
    if (!session) return null;
    const next = computeIconPosFromCursor(
      session.startCursor,
      session.startPos,
      cursor,
    );

    if (session.subject === 'window') {
      // Constrain the window to fit fully on the cursor's display.
      const final = clampWindowForDrag({
        candidate: next,
        size: session.startSize,
        cursor,
        prevPos: session.lastAppliedPos,
        allDisplays: ctx.allDisplays,
      });
      session.lastAppliedPos = final;
      return {
        subject: 'window',
        bounds: {
          x: final.x,
          y: final.y,
          width: session.startSize.width,
          height: session.startSize.height,
        },
      };
    }

    const clamped = clampIconForDrag({
      candidate: next,
      cursor,
      prevPos: currentIconPos,
      allDisplays: ctx.allDisplays,
    });
    return { subject: 'icon', position: clamped };
  }

  endDrag(
    cursor: ScreenPoint,
    ctx: GeometryContext,
    currentIconPos: IconPosition,
  ): DragEnd | null {
    const session = this.drag;
    if (!session) return null;
    this.drag = null;

    const dropped = computeIconPosFromCursor(
      session.startCursor,
      session.startPos,
      cursor,
    );

    if (session.subject === 'window') {
      // Snap considers the corners + edges of EVERY connected display,
      // so a release near the secondary monitor's bottom-right snaps
      // there. Corner beats edge — a corner is two edges flush, the
      // more specific match. Unsnapped releases fall back to the drag
      // clamp so the window stays where the user actually saw it.
      const size = session.startSize;
      const cornerSnap = snapWindowToCorner(dropped, size, ctx.allDisplays);
      const edgeSnap = cornerSnap
        ? null
        : snapWindowToEdge(dropped, size, ctx.allDisplays);
      const final =
        cornerSnap?.position ??
        edgeSnap?.position ??
        clampWindowForDrag({
          candidate: dropped,
          size,
          cursor,
          prevPos: session.lastAppliedPos,
          allDisplays: ctx.allDisplays,
        });
      return {
        subject: 'window',
        bounds: {
          x: final.x,
          y: final.y,
          width: size.width,
          height: size.height,
        },
        windowDragged: true,
      };
    }

    const snapped = snapToCorner(dropped, ctx.allDisplays);
    const final =
      snapped?.position ??
      clampIconForDrag({
        candidate: dropped,
        cursor,
        prevPos: currentIconPos,
        allDisplays: ctx.allDisplays,
      });
    return { subject: 'icon', position: final, persist: true };
  }

  // ---------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------

  startResize(
    corner: ResizeCorner,
    cursor: ScreenPoint,
    origin: WindowBounds,
  ): void {
    this.resize = { corner, startCursor: cursor, origin };
  }

  /** Square-locked resize step. Returns null when no session is open. */
  applyResize(cursor: ScreenPoint, ctx: GeometryContext): WindowBounds | null {
    const session = this.resize;
    if (!session) return null;
    // Cap the new size so the bounds stay on the display containing the
    // diagonal-fixed corner (the one that doesn't move this resize).
    // maxWindowSize is the absolute cap; maxSizeForResize is the
    // per-corner per-display cap that prevents spilling off the edge.
    const originCenter = {
      x: session.origin.x + session.origin.width / 2,
      y: session.origin.y + session.origin.height / 2,
    };
    const display = displayForPoint(originCenter, ctx.allDisplays, ctx.primary);
    const dispMax = maxSizeForResize({
      corner: session.corner,
      origin: session.origin,
      display,
    });
    return squareResize({
      origin: session.origin,
      corner: session.corner,
      cursorDx: cursor.x - session.startCursor.x,
      cursorDy: cursor.y - session.startCursor.y,
      minSize: WINDOW_MIN_SIZE_PX,
      maxSize: Math.max(
        WINDOW_MIN_SIZE_PX,
        Math.min(maxWindowSize(ctx.primary), dispMax),
      ),
    });
  }

  /** Final resize step; closes the session. */
  endResize(cursor: ScreenPoint, ctx: GeometryContext): WindowBounds | null {
    const final = this.applyResize(cursor, ctx);
    this.resize = null;
    return final;
  }
}
