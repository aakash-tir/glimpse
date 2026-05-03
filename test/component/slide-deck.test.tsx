import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  SlideDeck,
  SLIDE_TRANSITION_DURATION_S,
} from '../../src/renderer/src/components/slide-deck';

afterEach(cleanup);

function getDeck(): HTMLElement {
  return screen.getByTestId('slide-deck');
}

describe('SlideDeck — placeholder slide rendering', () => {
  it('renders the today slide first by default (moon + events off)', () => {
    render(<SlideDeck />);
    const deck = getDeck();
    expect(deck.getAttribute('data-current-slide-id')).toBe('today');
    expect(screen.getByTestId('slide-today')).toBeInTheDocument();
  });

  it('exposes the spec-required transition duration as a data attribute', () => {
    render(<SlideDeck />);
    expect(getDeck().getAttribute('data-transition-duration-s')).toBe(
      String(SLIDE_TRANSITION_DURATION_S),
    );
    expect(SLIDE_TRANSITION_DURATION_S).toBeCloseTo(0.5);
  });

  it('renders 4 visible slides with both flags off (no moon, no events)', () => {
    render(<SlideDeck moonEnabled={false} eventsActive={false} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('4');
  });

  it('renders 5 visible slides with moon on, events off', () => {
    render(<SlideDeck moonEnabled eventsActive={false} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('5');
  });

  it('renders 5 visible slides with events on, moon off', () => {
    render(<SlideDeck moonEnabled={false} eventsActive />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('5');
  });

  it('renders all 6 visible slides with both flags on', () => {
    render(<SlideDeck moonEnabled eventsActive />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('6');
  });

  it('every distinct slide is uniquely identifiable by testid as it becomes current', () => {
    const { rerender } = render(<SlideDeck moonEnabled eventsActive />);
    const expectedIds = [
      'today',
      'seven-day',
      'current',
      'moon',
      'events',
      'settings',
    ];
    for (let i = 0; i < expectedIds.length; i++) {
      const id = expectedIds[i];
      // First slide is `today` by default; advance with the next arrow
      // for every subsequent slide.
      if (i > 0) fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
      rerender(<SlideDeck moonEnabled eventsActive />);
      expect(screen.getByTestId(`slide-${id}`)).toBeInTheDocument();
      expect(getDeck().getAttribute('data-current-slide-id')).toBe(id);
    }
  });
});

describe('SlideDeck — arrow navigation triggers cube transition', () => {
  it('right arrow click advances the index and sets direction to "next"', () => {
    render(<SlideDeck />);
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('0');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('1');
    expect(getDeck().getAttribute('data-direction')).toBe('next');
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('seven-day');
  });

  it('left arrow click retreats the index and sets direction to "prev"', () => {
    render(<SlideDeck />);
    // Move forward then back so we have a non-trivial prev step.
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('2');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-prev'));
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('1');
    expect(getDeck().getAttribute('data-direction')).toBe('prev');
  });

  it('right arrow at the last slide wraps to the first (same direction, no reverse-spin)', () => {
    render(<SlideDeck />);
    // 4 visible slides → click 3 times to reach the last.
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    // Direction stays 'next' on wrap so the rotateY visual continues
    // in the click direction (no reverse-spin).
    expect(getDeck().getAttribute('data-direction')).toBe('next');
  });

  it('left arrow at the first slide wraps to the last (direction stays "prev")', () => {
    render(<SlideDeck />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-prev'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    expect(getDeck().getAttribute('data-direction')).toBe('prev');
  });

  it('arrow click stops event propagation so the panel double-click never fires', () => {
    let outerClickCount = 0;
    render(
      <div onClick={() => outerClickCount++}>
        <SlideDeck />
      </div>,
    );
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(outerClickCount).toBe(0);
  });
});

describe('SlideDeck — currently-viewed slide does not shift on visibility change', () => {
  it('user on settings stays on settings when moon turns on (index shifts but slide id is preserved)', () => {
    const { rerender } = render(<SlideDeck moonEnabled={false} />);
    // Advance to settings (index 3 with 4 visible slides).
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('3');

    rerender(<SlideDeck moonEnabled />);
    // Settings is still visible but its index moved from 3 → 4.
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('4');
  });

  it('user on today stays on today when events turn on (index unchanged, slide id preserved)', () => {
    const { rerender } = render(<SlideDeck eventsActive={false} />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    rerender(<SlideDeck eventsActive />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('0');
  });

  it('user on events falls back to current when events disappear', () => {
    const { rerender } = render(<SlideDeck eventsActive />);
    // 5 visible slides: today, seven-day, current, events, settings.
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // seven-day
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // current
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // events
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('events');

    rerender(<SlideDeck eventsActive={false} />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('current');
  });
});
