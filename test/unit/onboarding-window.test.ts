import { describe, it, expect } from 'vitest';
import {
  calloutPlacement,
  onboardingWindowBounds,
  ONBOARDING_MARGIN_PX,
  ONBOARDING_MIN_SIDE_PX,
} from '../../src/shared/onboarding-window';

describe('onboardingWindowBounds', () => {
  it('is a half-height square anchored top-right on a 1080p display', () => {
    const b = onboardingWindowBounds({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(b.width).toBe(540); // round(1080 / 2)
    expect(b.height).toBe(540);
    // Top-right with the standard margin.
    expect(b.x).toBe(1920 - 540 - ONBOARDING_MARGIN_PX);
    expect(b.y).toBe(ONBOARDING_MARGIN_PX);
  });

  it('respects a work-area offset (taskbar) when anchoring', () => {
    const b = onboardingWindowBounds({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
    expect(b.width).toBe(520);
    expect(b.x).toBe(1920 - 520 - ONBOARDING_MARGIN_PX);
    expect(b.y).toBe(ONBOARDING_MARGIN_PX);
  });

  it('clamps up to the minimum side on a very short display', () => {
    const b = onboardingWindowBounds({ x: 0, y: 0, width: 800, height: 600 });
    expect(b.width).toBe(ONBOARDING_MIN_SIDE_PX); // 300 < 320 floor
    expect(b.height).toBe(ONBOARDING_MIN_SIDE_PX);
  });

  it('clamps down so the square fits a narrow work area', () => {
    // Half-height (700) would exceed the available width (500 - 32).
    const b = onboardingWindowBounds({ x: 0, y: 0, width: 500, height: 1400 });
    expect(b.width).toBe(500 - ONBOARDING_MARGIN_PX * 2); // 468
    expect(b.height).toBe(468);
  });
});

describe('calloutPlacement', () => {
  it('centers when there is no spotlight', () => {
    expect(calloutPlacement(null, 540)).toBe('center');
  });

  it('places below a spotlight in the top half', () => {
    expect(calloutPlacement({ x: 10, y: 40, width: 60, height: 60 }, 540)).toBe(
      'below',
    );
  });

  it('places above a spotlight in the bottom half', () => {
    expect(
      calloutPlacement({ x: 10, y: 420, width: 60, height: 60 }, 540),
    ).toBe('above');
  });
});
