import { describe, it, expect } from 'vitest';
import {
  collapseTargetFromWindow,
  defaultWindowBounds,
  defaultWindowPosition,
  defaultWindowSize,
  expandFromIcon,
  isWindowAtDefaultPosition,
  maxWindowSize,
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
      snapWindowToCorner({ x: tl.x + 10, y: tl.y + 10 }, size, primary)?.corner,
    ).toBe('top-left');
    expect(
      snapWindowToCorner({ x: tr.x - 10, y: tr.y + 10 }, size, primary)?.corner,
    ).toBe('top-right');
    expect(
      snapWindowToCorner({ x: bl.x + 10, y: bl.y - 10 }, size, primary)?.corner,
    ).toBe('bottom-left');
    expect(
      snapWindowToCorner({ x: br.x - 10, y: br.y - 10 }, size, primary)?.corner,
    ).toBe('bottom-right');
  });

  it('snapped position has NO padding (unlike the icon snap)', () => {
    expect(snapWindowToCorner({ x: 5, y: 5 }, size, primary)?.position).toEqual(
      { x: 0, y: 0 },
    );
    expect(
      snapWindowToCorner({ x: tr.x + 5, y: -5 }, size, primary)?.position,
    ).toEqual(tr);
  });

  it('does not snap from an edge midpoint', () => {
    expect(
      snapWindowToCorner(
        { x: primary.width / 2 - size.width / 2, y: 0 },
        size,
        primary,
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
        primary,
      ),
    ).toBeNull();
  });

  it('snaps when distance equals the snap radius (inclusive boundary)', () => {
    expect(
      snapWindowToCorner(
        { x: tl.x, y: tl.y + WINDOW_SNAP_RADIUS_PX },
        size,
        primary,
      )?.corner,
    ).toBe('top-left');
  });

  it('does not snap when distance is one pixel beyond the snap radius', () => {
    expect(
      snapWindowToCorner(
        { x: tl.x, y: tl.y + WINDOW_SNAP_RADIUS_PX + 1 },
        size,
        primary,
      ),
    ).toBeNull();
  });

  it('picks the closest corner when two are within the radius', () => {
    const closeToTl = { x: tl.x + 10, y: tl.y + 5 };
    expect(snapWindowToCorner(closeToTl, size, primary)?.corner).toBe(
      'top-left',
    );
  });

  it('honors a custom radius', () => {
    const drop = { x: tl.x + 30, y: tl.y };
    expect(snapWindowToCorner(drop, size, primary, 20)).toBeNull();
    expect(snapWindowToCorner(drop, size, primary, 40)?.corner).toBe(
      'top-left',
    );
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
