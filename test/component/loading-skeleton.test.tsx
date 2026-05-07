import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  LoadingSkeleton,
  SHIMMER_PERIOD_S,
} from '../../src/renderer/src/components/loading-skeleton';

afterEach(cleanup);

describe('LoadingSkeleton', () => {
  it('exposes the spec-required 1.5 s shimmer period as a data attribute', () => {
    render(<LoadingSkeleton variant="hourly" />);
    const el = screen.getByTestId('loading-skeleton-hourly');
    expect(el.getAttribute('data-shimmer-period-s')).toBe(
      String(SHIMMER_PERIOD_S),
    );
    expect(SHIMMER_PERIOD_S).toBeCloseTo(1.5);
  });

  it('renders 6 hour-cell placeholders when variant=hourly (matches 6/page snap)', () => {
    render(<LoadingSkeleton variant="hourly" />);
    expect(screen.getAllByTestId('loading-skeleton-hour-cell')).toHaveLength(6);
  });

  it('renders 3 day-row placeholders when variant=seven-day (matches 3/page snap)', () => {
    render(<LoadingSkeleton variant="seven-day" />);
    expect(screen.getAllByTestId('loading-skeleton-day-row')).toHaveLength(3);
  });

  it('every block reports the shimmer animation as active', () => {
    render(<LoadingSkeleton variant="hourly" />);
    const blocks = [
      ...screen.getAllByTestId('skeleton-line'),
      ...screen.getAllByTestId('skeleton-icon'),
    ];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b.getAttribute('data-shimmer-active')).toBe('on');
    }
  });

  it('uses a row layout for hourly and column layout for seven-day', () => {
    const { rerender } = render(<LoadingSkeleton variant="hourly" />);
    expect(
      screen.getByTestId('loading-skeleton-hourly').style.flexDirection,
    ).toBe('row');
    rerender(<LoadingSkeleton variant="seven-day" />);
    expect(
      screen.getByTestId('loading-skeleton-seven-day').style.flexDirection,
    ).toBe('column');
  });
});
