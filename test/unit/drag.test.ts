import { describe, it, expect } from 'vitest';
import { computeIconPosFromCursor } from '../../src/shared/drag';

describe('computeIconPosFromCursor', () => {
  it('returns the start icon position when cursor has not moved', () => {
    const result = computeIconPosFromCursor(
      { x: 1000, y: 500 },
      { x: 970, y: 480 },
      { x: 1000, y: 500 },
    );
    expect(result).toEqual({ x: 970, y: 480 });
  });

  it('translates the icon by the cursor delta', () => {
    const result = computeIconPosFromCursor(
      { x: 1000, y: 500 },
      { x: 970, y: 480 },
      { x: 1100, y: 600 },
    );
    expect(result).toEqual({ x: 1070, y: 580 });
  });

  it('handles negative deltas (cursor moved up-left)', () => {
    const result = computeIconPosFromCursor(
      { x: 1000, y: 500 },
      { x: 970, y: 480 },
      { x: 800, y: 300 },
    );
    expect(result).toEqual({ x: 770, y: 280 });
  });

  it('preserves the cursor offset within the icon (icon follows cursor)', () => {
    // Cursor was 30 px right and 20 px down of the icon's top-left.
    const startCursor = { x: 1000, y: 500 };
    const startIcon = { x: 970, y: 480 };
    const currentCursor = { x: 1234, y: 1234 };
    const newIcon = computeIconPosFromCursor(
      startCursor,
      startIcon,
      currentCursor,
    );
    // Cursor offset within the icon should still be (30, 20) afterwards.
    expect(currentCursor.x - newIcon.x).toBe(30);
    expect(currentCursor.y - newIcon.y).toBe(20);
  });
});
