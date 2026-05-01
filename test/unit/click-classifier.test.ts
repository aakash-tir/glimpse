import { describe, it, expect } from 'vitest';
import {
  DOUBLE_CLICK_THRESHOLD_MS,
  isDoubleClick,
} from '../../src/shared/click-classifier';

describe('isDoubleClick', () => {
  it('is false when there is no previous click', () => {
    expect(isDoubleClick(null, 1000)).toBe(false);
  });

  it.each([
    { interval: 0, expected: true, label: 'instant double' },
    { interval: 50, expected: true, label: '50 ms' },
    { interval: 100, expected: true, label: '100 ms (spec example)' },
    { interval: 249, expected: true, label: 'just under threshold' },
    {
      interval: DOUBLE_CLICK_THRESHOLD_MS,
      expected: true,
      label: 'exactly at threshold (inclusive)',
    },
    { interval: 251, expected: false, label: 'just over threshold' },
    { interval: 300, expected: false, label: '300 ms (spec example)' },
    { interval: 1000, expected: false, label: '1 s' },
  ])(
    'returns $expected for an interval of $label',
    ({ interval, expected }) => {
      const prev = 1000;
      expect(isDoubleClick(prev, prev + interval)).toBe(expected);
    },
  );

  it('honors a custom threshold', () => {
    expect(isDoubleClick(0, 200, 100)).toBe(false);
    expect(isDoubleClick(0, 100, 100)).toBe(true);
  });
});
