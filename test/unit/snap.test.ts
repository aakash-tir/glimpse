import { describe, it, expect } from 'vitest';
import {
  cornerPositions,
  SNAP_RADIUS_PX,
  snapToCorner,
} from '../../src/shared/snap';
import {
  ICON_PADDING,
  ICON_SIZE,
  type DisplayBounds,
} from '../../src/shared/icon-position';

const primary: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };

describe('cornerPositions', () => {
  it('places each corner at ICON_PADDING from the screen edge', () => {
    const corners = cornerPositions([primary]);
    const byCorner = Object.fromEntries(
      corners.map((c) => [c.corner, c.position]),
    );

    expect(byCorner['top-left']).toEqual({ x: ICON_PADDING, y: ICON_PADDING });
    expect(byCorner['top-right']).toEqual({
      x: primary.width - ICON_SIZE - ICON_PADDING,
      y: ICON_PADDING,
    });
    expect(byCorner['bottom-left']).toEqual({
      x: ICON_PADDING,
      y: primary.height - ICON_SIZE - ICON_PADDING,
    });
    expect(byCorner['bottom-right']).toEqual({
      x: primary.width - ICON_SIZE - ICON_PADDING,
      y: primary.height - ICON_SIZE - ICON_PADDING,
    });
  });

  it('respects a non-zero display origin', () => {
    const offset: DisplayBounds = {
      x: 100,
      y: 200,
      width: 1280,
      height: 720,
    };
    const byCorner = Object.fromEntries(
      cornerPositions([offset]).map((c) => [c.corner, c.position]),
    );
    expect(byCorner['top-left']).toEqual({
      x: offset.x + ICON_PADDING,
      y: offset.y + ICON_PADDING,
    });
    expect(byCorner['bottom-right']).toEqual({
      x: offset.x + offset.width - ICON_SIZE - ICON_PADDING,
      y: offset.y + offset.height - ICON_SIZE - ICON_PADDING,
    });
  });

  it('returns 4 × N corners across multiple displays', () => {
    const displayB: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const corners = cornerPositions([primary, displayB]);
    expect(corners).toHaveLength(8);
    // Display A's top-left (x: 16) and display B's top-left (x: 1936)
    // both appear.
    const xValues = corners.map((c) => c.position.x);
    expect(xValues).toContain(ICON_PADDING);
    expect(xValues).toContain(displayB.x + ICON_PADDING);
  });
});

describe('snapToCorner', () => {
  const displays = [primary];
  // Each corner's snapped icon top-left.
  const tl = { x: ICON_PADDING, y: ICON_PADDING };
  const tr = { x: primary.width - ICON_SIZE - ICON_PADDING, y: ICON_PADDING };
  const bl = { x: ICON_PADDING, y: primary.height - ICON_SIZE - ICON_PADDING };
  const br = {
    x: primary.width - ICON_SIZE - ICON_PADDING,
    y: primary.height - ICON_SIZE - ICON_PADDING,
  };

  it('snaps to top-left when dropped exactly at the snapped position', () => {
    expect(snapToCorner(tl, displays)).toEqual({
      corner: 'top-left',
      position: tl,
    });
  });

  it('snaps to each of the 4 corners from a nearby drop', () => {
    expect(snapToCorner({ x: tl.x + 10, y: tl.y + 10 }, displays)?.corner).toBe(
      'top-left',
    );
    expect(snapToCorner({ x: tr.x - 10, y: tr.y + 10 }, displays)?.corner).toBe(
      'top-right',
    );
    expect(snapToCorner({ x: bl.x + 10, y: bl.y - 10 }, displays)?.corner).toBe(
      'bottom-left',
    );
    expect(snapToCorner({ x: br.x - 10, y: br.y - 10 }, displays)?.corner).toBe(
      'bottom-right',
    );
  });

  it('snaps when distance equals the snap radius (inclusive boundary)', () => {
    // Place drop SNAP_RADIUS_PX directly below the top-left snapped position.
    const drop = { x: tl.x, y: tl.y + SNAP_RADIUS_PX };
    expect(snapToCorner(drop, displays)?.corner).toBe('top-left');
  });

  it('does not snap when distance is one pixel beyond the snap radius', () => {
    const drop = { x: tl.x, y: tl.y + SNAP_RADIUS_PX + 1 };
    expect(snapToCorner(drop, displays)).toBeNull();
  });

  it('does not snap when dropped at the middle of an edge', () => {
    expect(
      snapToCorner({ x: primary.width / 2, y: tl.y }, displays),
    ).toBeNull();
    expect(
      snapToCorner({ x: primary.width / 2, y: bl.y }, displays),
    ).toBeNull();
    expect(
      snapToCorner({ x: tl.x, y: primary.height / 2 }, displays),
    ).toBeNull();
    expect(
      snapToCorner({ x: tr.x, y: primary.height / 2 }, displays),
    ).toBeNull();
  });

  it('does not snap when dropped near the screen center', () => {
    expect(
      snapToCorner({ x: primary.width / 2, y: primary.height / 2 }, displays),
    ).toBeNull();
  });

  it('snapped position preserves the 16 px padding', () => {
    const result = snapToCorner({ x: tr.x + 5, y: tr.y - 5 }, displays);
    expect(result?.position).toEqual(tr);
    // x is screenWidth - ICON_SIZE - ICON_PADDING; y is ICON_PADDING.
    expect(result?.position.y).toBe(ICON_PADDING);
    expect(result?.position.x).toBe(primary.width - ICON_SIZE - ICON_PADDING);
  });

  it('picks the closest corner when two are within the snap radius', () => {
    // Place the drop closer to top-left than to top-right.
    const closeToTl = { x: tl.x + 10, y: tl.y + 5 };
    expect(snapToCorner(closeToTl, displays)?.corner).toBe('top-left');
  });

  it('honors a custom radius', () => {
    const drop = { x: tl.x + 30, y: tl.y };
    expect(snapToCorner(drop, displays, 20)).toBeNull();
    expect(snapToCorner(drop, displays, 40)?.corner).toBe('top-left');
  });

  it('snaps to a corner of the SECONDARY display when the drop is near it', () => {
    // Two side-by-side displays. Drop near display B's bottom-right
    // snaps to that corner with the 16 px padding rule, NOT ignored
    // because the corner isn't on the primary.
    const displayB: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const both = [primary, displayB];
    const target = {
      x: displayB.x + displayB.width - ICON_SIZE - ICON_PADDING,
      y: displayB.height - ICON_SIZE - ICON_PADDING,
    };
    const result = snapToCorner({ x: target.x + 5, y: target.y + 5 }, both);
    expect(result?.corner).toBe('bottom-right');
    expect(result?.position).toEqual(target);
  });
});
