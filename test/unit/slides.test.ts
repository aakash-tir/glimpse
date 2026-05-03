import { describe, it, expect } from 'vitest';
import {
  computeVisibleSlides,
  reconcileCurrentSlideIndex,
  wrapStep,
  type SlideId,
} from '../../src/shared/slides';

describe('computeVisibleSlides', () => {
  it('hides moon and events by default', () => {
    expect(
      computeVisibleSlides({ moonEnabled: false, eventsActive: false }),
    ).toEqual(['today', 'seven-day', 'current', 'settings']);
  });

  it('inserts moon between current and (events|settings) when enabled', () => {
    expect(
      computeVisibleSlides({ moonEnabled: true, eventsActive: false }),
    ).toEqual(['today', 'seven-day', 'current', 'moon', 'settings']);
  });

  it('inserts events between current and settings when active', () => {
    expect(
      computeVisibleSlides({ moonEnabled: false, eventsActive: true }),
    ).toEqual(['today', 'seven-day', 'current', 'events', 'settings']);
  });

  it('shows all 6 slides when both flags are on', () => {
    expect(
      computeVisibleSlides({ moonEnabled: true, eventsActive: true }),
    ).toEqual([
      'today',
      'seven-day',
      'current',
      'moon',
      'events',
      'settings',
    ]);
  });

  it('keeps settings last regardless of flags', () => {
    for (const flags of [
      { moonEnabled: false, eventsActive: false },
      { moonEnabled: true, eventsActive: false },
      { moonEnabled: false, eventsActive: true },
      { moonEnabled: true, eventsActive: true },
    ]) {
      const list = computeVisibleSlides(flags);
      expect(list[list.length - 1]).toBe('settings');
    }
  });
});

describe('wrapStep', () => {
  it('advances by one within the list', () => {
    expect(wrapStep(0, 4, 'next')).toBe(1);
    expect(wrapStep(2, 4, 'next')).toBe(3);
  });

  it('retreats by one within the list', () => {
    expect(wrapStep(2, 4, 'prev')).toBe(1);
    expect(wrapStep(1, 4, 'prev')).toBe(0);
  });

  it('wraps last → first when going next', () => {
    expect(wrapStep(3, 4, 'next')).toBe(0);
  });

  it('wraps first → last when going prev', () => {
    expect(wrapStep(0, 4, 'prev')).toBe(3);
  });

  it('handles single-item list (always returns 0)', () => {
    expect(wrapStep(0, 1, 'next')).toBe(0);
    expect(wrapStep(0, 1, 'prev')).toBe(0);
  });

  it('returns 0 for empty list rather than NaN', () => {
    expect(wrapStep(0, 0, 'next')).toBe(0);
    expect(wrapStep(0, 0, 'prev')).toBe(0);
  });
});

describe('reconcileCurrentSlideIndex', () => {
  it('keeps the index when the same slide id remains in place', () => {
    const before: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    const after: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    expect(reconcileCurrentSlideIndex(before, 2, after)).toBe(2);
  });

  it('shifts the index when a slide is inserted before the current one', () => {
    // User on `settings` (index 3). Moon turns on → `moon` slot inserts
    // between `current` and `settings`. The user-visible slide is still
    // `settings`, but its index is now 4. The currently-viewed slide
    // does not shift.
    const before: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    const after: SlideId[] = [
      'today',
      'seven-day',
      'current',
      'moon',
      'settings',
    ];
    expect(reconcileCurrentSlideIndex(before, 3, after)).toBe(4);
  });

  it('shifts the index when a slide is removed before the current one', () => {
    // User on `settings` (index 4 with moon enabled). Moon turns off →
    // `settings` is now at index 3. User stays on `settings`.
    const before: SlideId[] = [
      'today',
      'seven-day',
      'current',
      'moon',
      'settings',
    ];
    const after: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    expect(reconcileCurrentSlideIndex(before, 4, after)).toBe(3);
  });

  it('keeps the index when a slide is inserted after the current one', () => {
    // User on `today` (index 0). Events become active. `today` is still
    // at index 0.
    const before: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    const after: SlideId[] = [
      'today',
      'seven-day',
      'current',
      'events',
      'settings',
    ];
    expect(reconcileCurrentSlideIndex(before, 0, after)).toBe(0);
  });

  it('falls back to the nearest preceding visible slide when the current one is removed', () => {
    // User on `events` (index 3). Events disappear (data refresh found
    // nothing). The nearest preceding slide that still exists is
    // `current` (now at index 2 in the new list).
    const before: SlideId[] = [
      'today',
      'seven-day',
      'current',
      'events',
      'settings',
    ];
    const after: SlideId[] = ['today', 'seven-day', 'current', 'settings'];
    expect(reconcileCurrentSlideIndex(before, 3, after)).toBe(2);
  });

  it('returns 0 when prevIndex is out of range', () => {
    const before: SlideId[] = ['today'];
    const after: SlideId[] = ['today', 'settings'];
    expect(reconcileCurrentSlideIndex(before, 99, after)).toBe(0);
  });

  it('returns 0 when the new visible list is empty', () => {
    const before: SlideId[] = ['today', 'settings'];
    const after: SlideId[] = [];
    expect(reconcileCurrentSlideIndex(before, 1, after)).toBe(0);
  });
});
