import { describe, it, expect } from 'vitest';
import {
  clampWindowForDrag,
  clampWindowToDisplay,
  collapseTargetFromWindow,
  defaultWindowBounds,
  defaultWindowPosition,
  defaultWindowSize,
  expandFromIcon,
  isWindowAtDefaultPosition,
  isWindowBoundsOnScreen,
  maxWindowSize,
  resolveWindowBoundsForExpand,
  snapWindowToCorner,
  squareResize,
  WINDOW_DEFAULT_SIZE_DENOM,
  WINDOW_MAX_MARGIN_PX,
  WINDOW_MIN_SIZE_PX,
  WINDOW_SNAP_RADIUS_PX,
  type ResizeCorner,
} from '../../src/shared/window-position';
import {
  defaultIconPosition,
  ICON_PADDING,
  ICON_SIZE,
  type DisplayBounds,
} from '../../src/shared/icon-position';

const primary: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
const small: DisplayBounds = { x: 0, y: 0, width: 1024, height: 768 };
const offsetPrimary: DisplayBounds = {
  x: 100,
  y: 200,
  width: 1280,
  height: 720,
};

describe('defaultWindowSize', () => {
  it('is 1/6 of the smallest dimension on a 1080p display', () => {
    expect(defaultWindowSize(primary)).toBe(
      Math.floor(1080 / WINDOW_DEFAULT_SIZE_DENOM),
    );
    expect(defaultWindowSize(primary)).toBe(180);
  });

  it('uses the smaller dimension on portrait or square-ish displays', () => {
    const portrait: DisplayBounds = { x: 0, y: 0, width: 720, height: 1280 };
    expect(defaultWindowSize(portrait)).toBe(120);
  });
});

describe('maxWindowSize', () => {
  it('is min(displayW, displayH) - WINDOW_MAX_MARGIN_PX on a normal display', () => {
    expect(maxWindowSize(primary)).toBe(1080 - WINDOW_MAX_MARGIN_PX);
  });

  it('never returns less than the min size', () => {
    const tiny: DisplayBounds = { x: 0, y: 0, width: 100, height: 100 };
    expect(maxWindowSize(tiny)).toBe(WINDOW_MIN_SIZE_PX);
  });
});

describe('defaultWindowPosition', () => {
  it('places the window in the top-right with 16 px padding', () => {
    const size = defaultWindowSize(primary);
    expect(defaultWindowPosition(primary)).toEqual({
      x: primary.width - size - ICON_PADDING,
      y: ICON_PADDING,
    });
  });

  it('respects a non-zero display origin', () => {
    const size = defaultWindowSize(offsetPrimary);
    expect(defaultWindowPosition(offsetPrimary)).toEqual({
      x: offsetPrimary.x + offsetPrimary.width - size - ICON_PADDING,
      y: offsetPrimary.y + ICON_PADDING,
    });
  });
});

describe('isWindowAtDefaultPosition', () => {
  it('returns true for the canonical default bounds', () => {
    expect(
      isWindowAtDefaultPosition(defaultWindowBounds(primary), primary),
    ).toBe(true);
  });

  it('returns false when position differs by even one pixel', () => {
    const def = defaultWindowBounds(primary);
    expect(isWindowAtDefaultPosition({ ...def, x: def.x - 1 }, primary)).toBe(
      false,
    );
  });

  it('returns false when size differs', () => {
    const def = defaultWindowBounds(primary);
    expect(
      isWindowAtDefaultPosition(
        { ...def, width: def.width + 10, height: def.height + 10 },
        primary,
      ),
    ).toBe(false);
  });
});

describe('expandFromIcon', () => {
  it('returns the default window bounds when icon sits at the default position', () => {
    const def = defaultIconPosition(primary);
    expect(expandFromIcon(def, primary)).toEqual(defaultWindowBounds(primary));
  });

  it('centers the window on the icon when icon is in the middle of the screen', () => {
    const iconPos = { x: 800, y: 500 };
    const size = defaultWindowSize(primary);
    const result = expandFromIcon(iconPos, primary);
    // window center = icon center
    expect(result.x + size / 2).toBeCloseTo(iconPos.x + ICON_SIZE / 2, 0);
    expect(result.y + size / 2).toBeCloseTo(iconPos.y + ICON_SIZE / 2, 0);
    expect(result.width).toBe(size);
    expect(result.height).toBe(size);
  });

  it('clamps the window to the display when the icon sits near the right edge', () => {
    // Icon near the right edge — its center is too close to the edge for
    // the window's center to align without going off-screen.
    const iconNearRight = { x: primary.width - ICON_SIZE - 5, y: 400 };
    const size = defaultWindowSize(primary);
    const result = expandFromIcon(iconNearRight, primary);
    expect(result.x + result.width).toBeLessThanOrEqual(
      primary.x + primary.width,
    );
    expect(result.width).toBe(size);
  });

  it('clamps the window to the display when the icon sits near the bottom-left edge', () => {
    const iconNearBottomLeft = { x: 5, y: primary.height - ICON_SIZE - 5 };
    const result = expandFromIcon(iconNearBottomLeft, primary);
    expect(result.x).toBeGreaterThanOrEqual(primary.x);
    expect(result.y + result.height).toBeLessThanOrEqual(
      primary.y + primary.height,
    );
  });

  it('respects a non-zero display origin', () => {
    const def = defaultIconPosition(offsetPrimary);
    expect(expandFromIcon(def, offsetPrimary)).toEqual(
      defaultWindowBounds(offsetPrimary),
    );
  });

  it('clamps to the SECONDARY display when the icon sits there (multi-monitor)', () => {
    // Two side-by-side 1920x1080 displays. Icon center on display B.
    const displayB: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const allDisplays = [primary, displayB];
    const iconOnB = { x: 2500, y: 400 };
    const result = expandFromIcon(iconOnB, primary, allDisplays);
    // Window must fit fully on display B, NOT yanked back to primary.
    expect(result.x).toBeGreaterThanOrEqual(displayB.x);
    expect(result.x + result.width).toBeLessThanOrEqual(
      displayB.x + displayB.width,
    );
    // Center should align with the icon's center.
    expect(result.x + result.width / 2).toBeCloseTo(
      iconOnB.x + ICON_SIZE / 2,
      0,
    );
  });

  it('still uses primary for the canonical default when icon is at primary default (multi-monitor)', () => {
    const displayB: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    };
    const def = defaultIconPosition(primary);
    expect(expandFromIcon(def, primary, [primary, displayB])).toEqual(
      defaultWindowBounds(primary),
    );
  });
});

describe('collapseTargetFromWindow', () => {
  it('returns the default icon position when the window is at the default position', () => {
    expect(
      collapseTargetFromWindow(defaultWindowBounds(primary), primary),
    ).toEqual(defaultIconPosition(primary));
  });

  it('places the icon at window-center → icon-center for a non-default window', () => {
    const bounds = { x: 600, y: 400, width: 200, height: 200 };
    const result = collapseTargetFromWindow(bounds, primary);
    // icon-center aligns with window-center
    expect(result.x + ICON_SIZE / 2).toBeCloseTo(
      bounds.x + bounds.width / 2,
      0,
    );
    expect(result.y + ICON_SIZE / 2).toBeCloseTo(
      bounds.y + bounds.height / 2,
      0,
    );
  });

  it('clamps the icon so it stays fully on the primary display (left edge)', () => {
    const bounds = { x: 0, y: 400, width: 200, height: 200 };
    const result = collapseTargetFromWindow(bounds, primary);
    expect(result.x).toBeGreaterThanOrEqual(primary.x);
  });

  it('clamps the icon so it stays fully on the primary display (right edge)', () => {
    const bounds = {
      x: primary.width - 200,
      y: 400,
      width: 200,
      height: 200,
    };
    const result = collapseTargetFromWindow(bounds, primary);
    expect(result.x + ICON_SIZE).toBeLessThanOrEqual(primary.x + primary.width);
  });

  it('clamps the icon at the bottom-right corner of the display', () => {
    const bounds = {
      x: primary.width - 100,
      y: primary.height - 100,
      width: 200,
      height: 200,
    };
    const result = collapseTargetFromWindow(bounds, primary);
    expect(result.x + ICON_SIZE).toBeLessThanOrEqual(primary.x + primary.width);
    expect(result.y + ICON_SIZE).toBeLessThanOrEqual(
      primary.y + primary.height,
    );
  });

  it('round-trips: expand from a non-default icon then collapse returns to that icon (when window stays put)', () => {
    const iconPos = { x: 600, y: 400 };
    const expanded = expandFromIcon(iconPos, primary);
    expect(collapseTargetFromWindow(expanded, primary)).toEqual(iconPos);
  });
});

describe('squareResize', () => {
  const origin = { x: 500, y: 500, width: 200, height: 200 };
  const minSize = WINDOW_MIN_SIZE_PX;
  const maxSize = 800;

  it('grows from bottom-right by max(dx, dy) and keeps the top-left fixed', () => {
    const result = squareResize({
      origin,
      corner: 'bottom-right',
      cursorDx: 50,
      cursorDy: 30,
      minSize,
      maxSize,
    });
    expect(result.width).toBe(250);
    expect(result.height).toBe(250);
    expect(result.x).toBe(origin.x);
    expect(result.y).toBe(origin.y);
  });

  it('grows from top-left and keeps the bottom-right fixed', () => {
    const result = squareResize({
      origin,
      corner: 'top-left',
      cursorDx: -40,
      cursorDy: -60,
      minSize,
      maxSize,
    });
    expect(result.width).toBe(260);
    expect(result.height).toBe(260);
    // bottom-right corner is preserved
    expect(result.x + result.width).toBe(origin.x + origin.width);
    expect(result.y + result.height).toBe(origin.y + origin.height);
  });

  it('grows from top-right and keeps the bottom-left fixed', () => {
    const result = squareResize({
      origin,
      corner: 'top-right',
      cursorDx: 30,
      cursorDy: -50,
      minSize,
      maxSize,
    });
    expect(result.width).toBe(250);
    expect(result.height).toBe(250);
    expect(result.x).toBe(origin.x);
    expect(result.y + result.height).toBe(origin.y + origin.height);
  });

  it('grows from bottom-left and keeps the top-right fixed', () => {
    const result = squareResize({
      origin,
      corner: 'bottom-left',
      cursorDx: -25,
      cursorDy: 40,
      minSize,
      maxSize,
    });
    expect(result.width).toBe(240);
    expect(result.height).toBe(240);
    expect(result.x + result.width).toBe(origin.x + origin.width);
    expect(result.y).toBe(origin.y);
  });

  it('clamps to minSize when cursor drags inward past the floor', () => {
    const result = squareResize({
      origin,
      corner: 'bottom-right',
      cursorDx: -500,
      cursorDy: -500,
      minSize: 120,
      maxSize,
    });
    expect(result.width).toBe(120);
    expect(result.height).toBe(120);
    // top-left still fixed
    expect(result.x).toBe(origin.x);
    expect(result.y).toBe(origin.y);
  });

  it('clamps to maxSize when cursor drags outward past the ceiling', () => {
    const result = squareResize({
      origin,
      corner: 'bottom-right',
      cursorDx: 5000,
      cursorDy: 5000,
      minSize,
      maxSize: 600,
    });
    expect(result.width).toBe(600);
    expect(result.height).toBe(600);
  });

  it('keeps width = height for asymmetric drags (the larger outward component wins)', () => {
    const result = squareResize({
      origin,
      corner: 'bottom-right',
      cursorDx: 100,
      cursorDy: 0,
      minSize,
      maxSize,
    });
    expect(result.width).toBe(result.height);
    expect(result.width).toBe(300);
  });

  it.each<ResizeCorner>([
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ])('returns the origin when the cursor has not moved (%s)', (corner) => {
    const result = squareResize({
      origin,
      corner,
      cursorDx: 0,
      cursorDy: 0,
      minSize,
      maxSize,
    });
    expect(result).toEqual(origin);
  });
});

describe('snapWindowToCorner', () => {
  const size = { width: 200, height: 200 };
  const displays = [primary];
  // Each corner's top-left for a 200x200 window on the 1920x1080 primary.
  const tl = { x: 0, y: 0 };
  const tr = { x: primary.width - size.width, y: 0 };
  const bl = { x: 0, y: primary.height - size.height };
  const br = {
    x: primary.width - size.width,
    y: primary.height - size.height,
  };

  it('snaps to each corner from a nearby drop', () => {
    expect(
      snapWindowToCorner({ x: tl.x + 10, y: tl.y + 10 }, size, displays)
        ?.corner,
    ).toBe('top-left');
    expect(
      snapWindowToCorner({ x: tr.x - 10, y: tr.y + 10 }, size, displays)
        ?.corner,
    ).toBe('top-right');
    expect(
      snapWindowToCorner({ x: bl.x + 10, y: bl.y - 10 }, size, displays)
        ?.corner,
    ).toBe('bottom-left');
    expect(
      snapWindowToCorner({ x: br.x - 10, y: br.y - 10 }, size, displays)
        ?.corner,
    ).toBe('bottom-right');
  });

  it('snapped position has NO padding (unlike the icon snap)', () => {
    expect(
      snapWindowToCorner({ x: 5, y: 5 }, size, displays)?.position,
    ).toEqual({ x: 0, y: 0 });
    expect(
      snapWindowToCorner({ x: tr.x + 5, y: -5 }, size, displays)?.position,
    ).toEqual(tr);
  });

  it('does not snap from an edge midpoint', () => {
    expect(
      snapWindowToCorner(
        { x: primary.width / 2 - size.width / 2, y: 0 },
        size,
        displays,
      ),
    ).toBeNull();
  });

  it('does not snap from the screen center', () => {
    expect(
      snapWindowToCorner(
        {
          x: primary.width / 2 - size.width / 2,
          y: primary.height / 2 - size.height / 2,
        },
        size,
        displays,
      ),
    ).toBeNull();
  });

  it('snaps when distance equals the snap radius (inclusive boundary)', () => {
    expect(
      snapWindowToCorner(
        { x: tl.x, y: tl.y + WINDOW_SNAP_RADIUS_PX },
        size,
        displays,
      )?.corner,
    ).toBe('top-left');
  });

  it('does not snap when distance is one pixel beyond the snap radius', () => {
    expect(
      snapWindowToCorner(
        { x: tl.x, y: tl.y + WINDOW_SNAP_RADIUS_PX + 1 },
        size,
        displays,
      ),
    ).toBeNull();
  });

  it('picks the closest corner when two are within the radius', () => {
    const closeToTl = { x: tl.x + 10, y: tl.y + 5 };
    expect(snapWindowToCorner(closeToTl, size, displays)?.corner).toBe(
      'top-left',
    );
  });

  it('honors a custom radius', () => {
    const drop = { x: tl.x + 30, y: tl.y };
    expect(snapWindowToCorner(drop, size, displays, 20)).toBeNull();
    expect(snapWindowToCorner(drop, size, displays, 40)?.corner).toBe(
      'top-left',
    );
  });

  it('snaps to a corner of the SECONDARY display when the drop is near it', () => {
    // Two side-by-side 1920x1080 displays. The window's natural snap
    // target on display B's bottom-right is at (B.x + B.w - size,
    // B.h - size) = (3840 - 200, 880) = (3640, 880). Drop near there
    // should snap to that corner — NOT be ignored because the corner
    // isn't on the primary.
    const displayB = { x: 1920, y: 0, width: 1920, height: 1080 };
    const both = [primary, displayB];
    const target = {
      x: displayB.x + displayB.width - size.width,
      y: displayB.height - size.height,
    };
    const result = snapWindowToCorner(
      { x: target.x + 10, y: target.y + 10 },
      size,
      both,
    );
    expect(result?.corner).toBe('bottom-right');
    expect(result?.position).toEqual(target);
  });

  it('picks the closest corner across all displays when several are in range', () => {
    // Two side-by-side displays. A drop right on the seam is closer to
    // primary's top-right than to display B's top-left (by ~size.width
    // either way — actually they're the same distance). Verify that
    // when the drop is biased toward primary, it picks primary's
    // top-right corner.
    const displayB = { x: 1920, y: 0, width: 1920, height: 1080 };
    const both = [primary, displayB];
    const primaryTR = { x: primary.width - size.width, y: 0 };
    const drop = { x: primaryTR.x + 5, y: 5 };
    const result = snapWindowToCorner(drop, size, both);
    expect(result?.corner).toBe('top-right');
    expect(result?.position).toEqual(primaryTR);
  });
});

describe('isWindowBoundsOnScreen', () => {
  it('returns true for bounds fully inside a single display', () => {
    expect(
      isWindowBoundsOnScreen({ x: 100, y: 100, width: 200, height: 200 }, [
        primary,
      ]),
    ).toBe(true);
  });

  it('returns false for bounds that overlap the right edge', () => {
    expect(
      isWindowBoundsOnScreen(
        { x: primary.width - 50, y: 100, width: 200, height: 200 },
        [primary],
      ),
    ).toBe(false);
  });

  it('returns false for bounds with negative coordinates', () => {
    expect(
      isWindowBoundsOnScreen({ x: -50, y: -50, width: 200, height: 200 }, [
        primary,
      ]),
    ).toBe(false);
  });

  it('returns true for bounds fully on a secondary display', () => {
    const secondary: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1280,
      height: 720,
    };
    expect(
      isWindowBoundsOnScreen({ x: 2000, y: 100, width: 400, height: 400 }, [
        primary,
        secondary,
      ]),
    ).toBe(true);
  });

  it('returns false when no displays are connected', () => {
    expect(
      isWindowBoundsOnScreen({ x: 0, y: 0, width: 100, height: 100 }, []),
    ).toBe(false);
  });
});

describe('resolveWindowBoundsForExpand', () => {
  const iconPos = { x: 800, y: 500 };
  const savedBounds = { x: 200, y: 200, width: 400, height: 400 };

  it('uses default expand-from-icon when trackWindowPosition is off', () => {
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: false,
      savedBounds,
      allDisplays: [primary],
    });
    expect(result).toEqual(expandFromIcon(iconPos, primary));
  });

  it('uses saved bounds when trackWindowPosition is on and bounds are on-screen', () => {
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: true,
      savedBounds,
      allDisplays: [primary],
    });
    expect(result).toEqual(savedBounds);
  });

  it('falls back to default when trackWindowPosition is on but no saved bounds', () => {
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: true,
      savedBounds: null,
      allDisplays: [primary],
    });
    expect(result).toEqual(expandFromIcon(iconPos, primary));
  });

  it('falls back to default when trackWindowPosition is on but bounds are off-screen (monitor change)', () => {
    const offScreen = { x: 2500, y: 100, width: 400, height: 400 };
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: true,
      savedBounds: offScreen,
      allDisplays: [primary],
    });
    expect(result).toEqual(expandFromIcon(iconPos, primary));
  });
});

describe('small display interactions', () => {
  it('default window size on a 768 p display still respects 1/6', () => {
    expect(defaultWindowSize(small)).toBe(Math.floor(768 / 6));
  });

  it('expandFromIcon clamps within a small display', () => {
    const iconPos = { x: small.width - ICON_SIZE - 5, y: 400 };
    const result = expandFromIcon(iconPos, small);
    expect(result.x + result.width).toBeLessThanOrEqual(small.x + small.width);
  });
});

describe('clampWindowToDisplay', () => {
  const size = { width: 200, height: 200 };

  it('returns the point unchanged when fully inside the display', () => {
    expect(clampWindowToDisplay({ x: 500, y: 400 }, size, primary)).toEqual({
      x: 500,
      y: 400,
    });
  });

  it('clamps to right edge when the window would overflow horizontally', () => {
    expect(clampWindowToDisplay({ x: 1900, y: 400 }, size, primary)).toEqual({
      x: 1920 - 200,
      y: 400,
    });
  });

  it('clamps to bottom edge when the window would overflow vertically', () => {
    expect(clampWindowToDisplay({ x: 500, y: 1000 }, size, primary)).toEqual({
      x: 500,
      y: 1080 - 200,
    });
  });

  it('clamps to top-left when the candidate is far above-left', () => {
    expect(clampWindowToDisplay({ x: -500, y: -300 }, size, primary)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('respects display origin offsets', () => {
    expect(
      clampWindowToDisplay({ x: -50, y: 100 }, size, offsetPrimary),
    ).toEqual({
      x: offsetPrimary.x,
      y: 200,
    });
  });
});

describe('clampWindowForDrag — single display', () => {
  const size = { width: 200, height: 200 };
  const displays = [primary];

  it('passes the candidate through when it fits on the cursor display', () => {
    const candidate = { x: 500, y: 400 };
    expect(
      clampWindowForDrag({
        candidate,
        size,
        cursor: { x: 600, y: 500 },
        prevPos: { x: 480, y: 380 },
        allDisplays: displays,
      }),
    ).toEqual(candidate);
  });

  it('clamps to right edge when dragging past the right of the screen', () => {
    expect(
      clampWindowForDrag({
        candidate: { x: 1900, y: 400 },
        size,
        cursor: { x: 1900, y: 500 },
        prevPos: { x: 1700, y: 400 },
        allDisplays: displays,
      }),
    ).toEqual({ x: 1920 - 200, y: 400 });
  });

  it('clamps to bottom edge when dragging past the bottom of the screen', () => {
    expect(
      clampWindowForDrag({
        candidate: { x: 500, y: 1000 },
        size,
        cursor: { x: 500, y: 1075 },
        prevPos: { x: 500, y: 850 },
        allDisplays: displays,
      }),
    ).toEqual({ x: 500, y: 1080 - 200 });
  });

  it('returns prevPos when no displays are connected (defensive)', () => {
    const prev = { x: 100, y: 100 };
    expect(
      clampWindowForDrag({
        candidate: { x: 9999, y: 9999 },
        size,
        cursor: { x: 5, y: 5 },
        prevPos: prev,
        allDisplays: [],
      }),
    ).toEqual(prev);
  });
});

describe('clampWindowForDrag — multi-display seam', () => {
  // Two side-by-side 1080p displays. Display B starts at x=1920.
  const displayA: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
  const displayB: DisplayBounds = {
    x: 1920,
    y: 0,
    width: 1920,
    height: 1080,
  };
  const displays = [displayA, displayB];
  const size = { width: 400, height: 300 };

  it('passes the candidate through when it fits on display A and the cursor is on A', () => {
    const candidate = { x: 1500, y: 400 };
    expect(
      clampWindowForDrag({
        candidate,
        size,
        cursor: { x: 1700, y: 500 },
        prevPos: { x: 1480, y: 400 },
        allDisplays: displays,
      }),
    ).toEqual(candidate);
  });

  it('clamps to A when cursor crosses to B but window does not fit on B yet', () => {
    // Cursor is in B (x ≥ 1920) but the candidate's right edge spills
    // past A's right edge (would put the window partially off A) AND
    // doesn't yet fit on B (would put it partially off B's left
    // edge). The window must hug A's right edge.
    expect(
      clampWindowForDrag({
        candidate: { x: 1700, y: 400 },
        size,
        cursor: { x: 2000, y: 500 },
        prevPos: { x: 1500, y: 400 },
        allDisplays: displays,
      }),
    ).toEqual({ x: 1920 - 400, y: 400 });
  });

  it('jumps to B once the candidate fits fully on B', () => {
    // Cursor is well into B; the candidate fits fully on B.
    const candidate = { x: 2200, y: 400 };
    expect(
      clampWindowForDrag({
        candidate,
        size,
        cursor: { x: 2400, y: 500 },
        prevPos: { x: 1500, y: 400 },
        allDisplays: displays,
      }),
    ).toEqual(candidate);
  });

  it('clamps to B when window was already on B and cursor wanders off-screen', () => {
    expect(
      clampWindowForDrag({
        candidate: { x: 3700, y: 400 },
        size,
        cursor: { x: 3900, y: 500 },
        prevPos: { x: 3000, y: 400 },
        allDisplays: displays,
      }),
    ).toEqual({ x: 3840 - 400, y: 400 });
  });

  it('handles the cursor sitting in a gap between displays by holding on prevPos display', () => {
    // Stacked displays with a 50 px vertical gap.
    const top: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const bottom: DisplayBounds = {
      x: 0,
      y: 1130,
      width: 1920,
      height: 1080,
    };
    expect(
      clampWindowForDrag({
        candidate: { x: 100, y: 1100 },
        size,
        // Cursor is in the gap (no display contains it).
        cursor: { x: 100, y: 1100 },
        prevPos: { x: 100, y: 800 },
        allDisplays: [top, bottom],
      }),
    ).toEqual({ x: 100, y: 1080 - 300 });
  });
});
