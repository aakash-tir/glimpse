import { describe, it, expect } from 'vitest';
import {
  defaultIconPosition,
  displayForIcon,
  isPositionOnScreen,
  resolveIconPosition,
  shouldResetIconPosition,
  ICON_SIZE,
  ICON_PADDING,
  type DisplayBounds,
} from '../../src/shared/icon-position';

const primary: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };

describe('defaultIconPosition', () => {
  it('returns top-right of the primary display with 16px padding', () => {
    expect(defaultIconPosition(primary)).toEqual({
      x: primary.width - ICON_SIZE - ICON_PADDING,
      y: ICON_PADDING,
    });
  });

  it('respects a non-zero display origin', () => {
    const offset: DisplayBounds = { x: 1920, y: 0, width: 1280, height: 720 };
    expect(defaultIconPosition(offset)).toEqual({
      x: 1920 + 1280 - ICON_SIZE - ICON_PADDING,
      y: ICON_PADDING,
    });
  });
});

describe('isPositionOnScreen', () => {
  it('returns true for a position fully inside a display', () => {
    expect(isPositionOnScreen({ x: 100, y: 100 }, [primary])).toBe(true);
  });

  it('returns false when the icon would overlap the right edge', () => {
    expect(
      isPositionOnScreen({ x: primary.width - 10, y: 100 }, [primary]),
    ).toBe(false);
  });

  it('returns false when the icon would overlap the bottom edge', () => {
    expect(
      isPositionOnScreen({ x: 100, y: primary.height - 10 }, [primary]),
    ).toBe(false);
  });

  it('returns false for negative coordinates outside any display', () => {
    expect(isPositionOnScreen({ x: -100, y: -100 }, [primary])).toBe(false);
  });

  it('returns true if the icon is fully contained on a secondary display', () => {
    const secondary: DisplayBounds = {
      x: 1920,
      y: 0,
      width: 1280,
      height: 720,
    };
    expect(isPositionOnScreen({ x: 2000, y: 100 }, [primary, secondary])).toBe(
      true,
    );
  });

  it('returns false when no displays are connected', () => {
    expect(isPositionOnScreen({ x: 0, y: 0 }, [])).toBe(false);
  });
});

describe('resolveIconPosition', () => {
  it('returns the saved position when it is on-screen', () => {
    const saved = { x: 500, y: 500 };
    expect(resolveIconPosition(saved, primary, [primary])).toEqual(saved);
  });

  it('falls back to default top-right when saved is null', () => {
    expect(resolveIconPosition(null, primary, [primary])).toEqual(
      defaultIconPosition(primary),
    );
  });

  it('falls back to default when saved position is off-screen (monitor disconnected)', () => {
    const wasOnSecondary = { x: 2500, y: 100 };
    expect(resolveIconPosition(wasOnSecondary, primary, [primary])).toEqual(
      defaultIconPosition(primary),
    );
  });

  it('falls back to default when resolution change leaves saved position off-screen', () => {
    const oldHigh: DisplayBounds = { x: 0, y: 0, width: 3840, height: 2160 };
    const onOldHigh = { x: 3700, y: 100 };
    expect(isPositionOnScreen(onOldHigh, [oldHigh])).toBe(true);
    expect(resolveIconPosition(onOldHigh, primary, [primary])).toEqual(
      defaultIconPosition(primary),
    );
  });

  it('falls back to default when primary monitor is swapped to a smaller one', () => {
    const smaller: DisplayBounds = { x: 0, y: 0, width: 1024, height: 768 };
    const onLargerPrimary = { x: 1500, y: 100 };
    expect(resolveIconPosition(onLargerPrimary, smaller, [smaller])).toEqual(
      defaultIconPosition(smaller),
    );
  });
});

describe('shouldResetIconPosition', () => {
  it('returns false when there is no saved position', () => {
    expect(shouldResetIconPosition(null, [primary])).toBe(false);
  });

  it('returns false when the saved position is on the current displays', () => {
    expect(shouldResetIconPosition({ x: 500, y: 500 }, [primary])).toBe(false);
  });

  it.each([
    {
      label: 'monitor disconnected',
      saved: { x: 2500, y: 100 },
      displays: [primary],
    },
    {
      label: 'resolution shrunk (4K → 1080p)',
      saved: { x: 3700, y: 100 },
      displays: [primary],
    },
    {
      label: 'primary swapped to smaller display',
      saved: { x: 1500, y: 100 },
      displays: [{ x: 0, y: 0, width: 1024, height: 768 } as DisplayBounds],
    },
  ])(
    'returns true when $label leaves saved off-screen',
    ({ saved, displays }) => {
      expect(shouldResetIconPosition(saved, displays)).toBe(true);
    },
  );
});

describe('displayForIcon', () => {
  const displayB: DisplayBounds = {
    x: 1920,
    y: 0,
    width: 1920,
    height: 1080,
  };

  it('returns the display containing the icon center on a single display', () => {
    expect(displayForIcon({ x: 500, y: 400 }, [primary], primary)).toEqual(
      primary,
    );
  });

  it('returns the secondary display when the icon center is on it', () => {
    expect(
      displayForIcon({ x: 2500, y: 400 }, [primary, displayB], primary),
    ).toEqual(displayB);
  });

  it('returns the closest display when the icon center is in a gap', () => {
    // Stacked displays with a 100 px vertical gap; icon center sits
    // in the gap. Distance to top's center is shorter, so top wins.
    const top: DisplayBounds = { x: 0, y: 0, width: 1920, height: 600 };
    const bottom: DisplayBounds = {
      x: 0,
      y: 700,
      width: 1920,
      height: 600,
    };
    // Icon at y=620 → center at y=652. Top center=300, bottom center=1000.
    // |652 - 300| = 352, |652 - 1000| = 348 → bottom is slightly closer.
    expect(displayForIcon({ x: 100, y: 620 }, [top, bottom], primary)).toEqual(
      bottom,
    );
  });

  it('falls back to primary when displays is empty', () => {
    expect(displayForIcon({ x: 500, y: 400 }, [], primary)).toEqual(primary);
  });
});
