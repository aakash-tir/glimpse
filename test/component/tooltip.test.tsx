import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { Tooltip } from '../../src/renderer/src/components/tooltip';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Tooltip — hover delay + appearance', () => {
  it('does NOT show before the 200 ms hover delay elapses', () => {
    render(
      <Tooltip text="hi there">
        <button data-testid="tt-target">target</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByTestId('tt-target').parentElement!);
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('shows after the 200 ms hover delay', () => {
    render(
      <Tooltip text="hi there">
        <button data-testid="tt-target">target</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByTestId('tt-target').parentElement!);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip').textContent).toBe('hi there');
  });

  it('exposes the spec-required 200 ms delay as a data attribute', () => {
    render(
      <Tooltip text="x">
        <span data-testid="tt-target">x</span>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByTestId('tt-target').parentElement!);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip.getAttribute('data-tooltip-delay-ms')).toBe('200');
  });

  it('hides immediately on mouseleave', () => {
    render(
      <Tooltip text="x">
        <span data-testid="tt-target">x</span>
      </Tooltip>,
    );
    const wrapper = screen.getByTestId('tt-target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('does not show at all if mouse leaves before the delay elapses', () => {
    render(
      <Tooltip text="x">
        <span data-testid="tt-target">x</span>
      </Tooltip>,
    );
    const wrapper = screen.getByTestId('tt-target').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.mouseLeave(wrapper);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });
});

describe('Tooltip — dark-glass styling', () => {
  it('uses the spec-required background, border, and font size', () => {
    render(
      <Tooltip text="x">
        <span data-testid="tt-target">x</span>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByTestId('tt-target').parentElement!);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const tooltip = screen.getByTestId('tooltip') as HTMLElement;
    // rgba(20, 20, 30, 0.85) per plan/styling.md tooltip palette.
    expect(tooltip.style.background).toMatch(/rgba\(20,\s*20,\s*30,\s*0\.85\)/);
    // 1 px white-10 % border.
    expect(tooltip.style.border).toMatch(
      /1px solid rgba\(255,\s*255,\s*255,\s*0\.1\)/,
    );
    // 12 px text.
    expect(tooltip.style.fontSize).toBe('12px');
    // 8 px border radius.
    expect(tooltip.style.borderRadius).toBe('8px');
  });

  it('renders with role="tooltip" for accessibility', () => {
    render(
      <Tooltip text="x">
        <span data-testid="tt-target">x</span>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByTestId('tt-target').parentElement!);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});
