import { describe, it, expect } from 'vitest';
import { GestureController } from '../../src/main/gesture-session';
import type { DisplayBounds } from '../../src/shared/icon-position';
import { ICON_SIZE, ICON_PADDING } from '../../src/shared/icon-position';

// Until M11 this logic lived inline in main/index.ts and could only be
// reached through Playwright, because that module touches Electron at
// import time. These cover the state machine directly.

const PRIMARY: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
const SECOND: DisplayBounds = { x: 1920, y: 0, width: 1920, height: 1080 };
const ctx = (
  displays: DisplayBounds[] = [PRIMARY],
): {
  allDisplays: DisplayBounds[];
  primary: DisplayBounds;
} => ({ allDisplays: displays, primary: PRIMARY });

const WIN = { x: 800, y: 400, width: 200, height: 200 };
const ICON = { x: 900, y: 500 };

describe('GestureController — session lifecycle', () => {
  it('reports no gesture in flight before anything starts', () => {
    const g = new GestureController();
    expect(g.isDragging).toBe(false);
    expect(g.isResizing).toBe(false);
  });

  it('returns null for move/end when no drag is open', () => {
    const g = new GestureController();
    expect(g.moveDrag({ x: 10, y: 10 }, ctx(), ICON)).toBeNull();
    expect(g.endDrag({ x: 10, y: 10 }, ctx(), ICON)).toBeNull();
  });

  it('returns null for resize steps when no resize is open', () => {
    const g = new GestureController();
    expect(g.applyResize({ x: 10, y: 10 }, ctx())).toBeNull();
    expect(g.endResize({ x: 10, y: 10 }, ctx())).toBeNull();
  });

  it('endDrag closes the session — a second end is a no-op', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    expect(g.isDragging).toBe(true);
    expect(g.endDrag({ x: 950, y: 550 }, ctx(), ICON)).not.toBeNull();
    expect(g.isDragging).toBe(false);
    expect(g.endDrag({ x: 950, y: 550 }, ctx(), ICON)).toBeNull();
  });

  it('reset() drops both in-flight gestures', () => {
    // Mirrors the window 'closed' handler: a destroyed window must not
    // leave a session that a late IPC message could act on.
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    g.reset();
    expect(g.isDragging).toBe(false);
    expect(g.isResizing).toBe(false);
    expect(g.moveDrag({ x: 10, y: 10 }, ctx(), ICON)).toBeNull();
    expect(g.applyResize({ x: 10, y: 10 }, ctx())).toBeNull();
  });
});

describe('GestureController — window drag', () => {
  it('translates the window by the cursor delta, preserving grab offset', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    const move = g.moveDrag({ x: 950, y: 530 }, ctx(), ICON);
    expect(move).toEqual({
      subject: 'window',
      bounds: { x: 850, y: 430, width: 200, height: 200 },
    });
  });

  it('never lets a drag take the window off the display', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    // Cursor hurled far past the top-left corner.
    const move = g.moveDrag({ x: 5, y: 5 }, ctx(), ICON);
    expect(move?.subject).toBe('window');
    if (move?.subject !== 'window') throw new Error('expected window move');
    expect(move.bounds.x).toBeGreaterThanOrEqual(0);
    expect(move.bounds.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps the size captured at drag start for every tick', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    for (const c of [
      { x: 910, y: 510 },
      { x: 700, y: 300 },
      { x: 1200, y: 800 },
    ]) {
      const move = g.moveDrag(c, ctx(), ICON);
      if (move?.subject !== 'window') throw new Error('expected window move');
      expect(move.bounds.width).toBe(200);
      expect(move.bounds.height).toBe(200);
    }
  });

  it('snaps to a display corner on release within radius', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    // Drop the window's top-left ~10 px from (0, 0).
    const end = g.endDrag({ x: 110, y: 110 }, ctx(), ICON);
    if (end?.subject !== 'window') throw new Error('expected window end');
    expect(end.bounds).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(end.windowDragged).toBe(true);
  });

  it('a release beyond the screen edge still lands fully on-screen', () => {
    // The M3 regression: an edge snap carried the unclamped axis, so
    // this parked the window partly outside the display.
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    const end = g.endDrag({ x: -400, y: 105 }, ctx(), ICON);
    if (end?.subject !== 'window') throw new Error('expected window end');
    expect(end.bounds.x).toBeGreaterThanOrEqual(0);
    expect(end.bounds.x + end.bounds.width).toBeLessThanOrEqual(PRIMARY.width);
    expect(end.bounds.y).toBeGreaterThanOrEqual(0);
  });

  it('flags windowDragged so the next collapse uses case B3', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    const end = g.endDrag({ x: 905, y: 505 }, ctx(), ICON);
    if (end?.subject !== 'window') throw new Error('expected window end');
    expect(end.windowDragged).toBe(true);
  });

  it('can move onto a second display when the window fits there', () => {
    const g = new GestureController();
    g.startWindowDrag({ x: 900, y: 500 }, WIN);
    // Push the cursor well into the secondary display.
    const move = g.moveDrag({ x: 3000, y: 600 }, ctx([PRIMARY, SECOND]), ICON);
    if (move?.subject !== 'window') throw new Error('expected window move');
    expect(move.bounds.x).toBeGreaterThanOrEqual(SECOND.x);
    expect(move.bounds.x + move.bounds.width).toBeLessThanOrEqual(
      SECOND.x + SECOND.width,
    );
  });
});

describe('GestureController — icon drag', () => {
  it('translates the icon by the cursor delta', () => {
    const g = new GestureController();
    g.startIconDrag({ x: 900, y: 500 }, ICON);
    const move = g.moveDrag({ x: 920, y: 540 }, ctx(), ICON);
    expect(move).toEqual({ subject: 'icon', position: { x: 920, y: 540 } });
  });

  it('snaps to a screen corner on release, preserving the 16 px padding', () => {
    const g = new GestureController();
    g.startIconDrag({ x: 900, y: 500 }, ICON);
    // Cursor delta lands the icon's top-left at (20, 20) — inside the
    // 40 px radius of the top-left rest spot at (16, 16).
    const end = g.endDrag({ x: 20, y: 20 }, ctx(), ICON);
    if (end?.subject !== 'icon') throw new Error('expected icon end');
    expect(end.position).toEqual({ x: ICON_PADDING, y: ICON_PADDING });
    expect(end.persist).toBe(true);
  });

  it('snaps to the bottom-right corner with the same padding', () => {
    const g = new GestureController();
    const start = { x: 100, y: 100 };
    g.startIconDrag({ x: 0, y: 0 }, start);
    // Land the icon's top-left within radius of the bottom-right rest spot.
    const target = {
      x: PRIMARY.width - ICON_SIZE - ICON_PADDING,
      y: PRIMARY.height - ICON_SIZE - ICON_PADDING,
    };
    const end = g.endDrag(
      { x: target.x - start.x + 5, y: target.y - start.y + 5 },
      ctx(),
      start,
    );
    if (end?.subject !== 'icon') throw new Error('expected icon end');
    expect(end.position).toEqual(target);
  });

  it('a mid-screen release does not snap — it stays where dropped', () => {
    const g = new GestureController();
    g.startIconDrag({ x: 900, y: 500 }, ICON);
    const end = g.endDrag({ x: 1000, y: 600 }, ctx(), ICON);
    if (end?.subject !== 'icon') throw new Error('expected icon end');
    expect(end.position).toEqual({ x: 1000, y: 600 });
  });

  it('an icon drag never reports windowDragged', () => {
    const g = new GestureController();
    g.startIconDrag({ x: 900, y: 500 }, ICON);
    const end = g.endDrag({ x: 1000, y: 600 }, ctx(), ICON);
    expect(end).not.toHaveProperty('windowDragged');
  });
});

describe('GestureController — resize', () => {
  it('keeps the window square while dragging a corner', () => {
    const g = new GestureController();
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    // Uneven cursor delta — the square lock must reconcile it.
    const next = g.applyResize({ x: 1080, y: 630 }, ctx());
    expect(next).not.toBeNull();
    expect(next?.width).toBe(next?.height);
  });

  it('never shrinks below the 120 px minimum', () => {
    const g = new GestureController();
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    const next = g.applyResize({ x: 200, y: 200 }, ctx());
    expect(next?.width).toBeGreaterThanOrEqual(120);
    expect(next?.height).toBeGreaterThanOrEqual(120);
  });

  it('never grows off the display', () => {
    const g = new GestureController();
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    const next = g.applyResize({ x: 9000, y: 9000 }, ctx());
    if (!next) throw new Error('expected bounds');
    expect(next.x + next.width).toBeLessThanOrEqual(PRIMARY.width);
    expect(next.y + next.height).toBeLessThanOrEqual(PRIMARY.height);
  });

  it('holds the diagonally-opposite corner fixed', () => {
    const g = new GestureController();
    // Dragging bottom-right must leave the top-left where it was.
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    const next = g.applyResize({ x: 1100, y: 700 }, ctx());
    expect(next?.x).toBe(WIN.x);
    expect(next?.y).toBe(WIN.y);
  });

  it('moves the origin when dragging the top-left corner', () => {
    const g = new GestureController();
    g.startResize('top-left', { x: 800, y: 400 }, WIN);
    const next = g.applyResize({ x: 750, y: 350 }, ctx());
    if (!next) throw new Error('expected bounds');
    // Growing up-left: the bottom-right stays put.
    expect(next.x + next.width).toBe(WIN.x + WIN.width);
    expect(next.y + next.height).toBe(WIN.y + WIN.height);
  });

  it('endResize returns the final bounds and closes the session', () => {
    const g = new GestureController();
    g.startResize('bottom-right', { x: 1000, y: 600 }, WIN);
    const final = g.endResize({ x: 1100, y: 700 }, ctx());
    expect(final).not.toBeNull();
    expect(g.isResizing).toBe(false);
    expect(g.endResize({ x: 1100, y: 700 }, ctx())).toBeNull();
  });
});
