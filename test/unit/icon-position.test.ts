import { describe, it, expect } from 'vitest';
import {
  defaultIconPosition,
  isPositionOnScreen,
  resolveIconPosition,
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
