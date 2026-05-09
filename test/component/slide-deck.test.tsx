import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  SlideDeck,
  SLIDE_TRANSITION_DURATION_S,
} from '../../src/renderer/src/components/slide-deck';
import type { SpecialEvent } from '../../src/shared/special-events';

afterEach(cleanup);

const AURORA_TODAY: SpecialEvent = {
  type: 'aurora',
  id: 'event:aurora',
  dayOffset: 0,
  kp: 6,
  latitude: 60,
  visibilityText: 'Visible from your location',
};

const PERSEIDS_TODAY: SpecialEvent = {
  type: 'meteor',
  id: 'event:meteor:Perseids',
  dayOffset: 0,
  shower: {
    name: 'Perseids',
    peakDate: '2026-08-12',
    zhr: 100,
    bestViewingTime: 'Late night to pre-dawn',
    radiantConstellation: 'Perseus',
  },
};

function getDeck(): HTMLElement {
  return screen.getByTestId('slide-deck');
}

describe('SlideDeck — slide rendering', () => {
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
    render(<SlideDeck moonEnabled={false} events={[]} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('4');
  });

  it('renders 5 visible slides with moon on, events off', () => {
    render(<SlideDeck moonEnabled events={[]} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('5');
  });

  it('renders 5 visible slides with one event active, moon off', () => {
    render(<SlideDeck moonEnabled={false} events={[AURORA_TODAY]} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('5');
  });

  it('renders one slide per event when multiple are active', () => {
    render(<SlideDeck events={[AURORA_TODAY, PERSEIDS_TODAY]} />);
    // 4 static (no moon) + 2 event = 6.
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('6');
  });

  it('renders all 6 slides with moon on + one event', () => {
    render(<SlideDeck moonEnabled events={[AURORA_TODAY]} />);
    expect(getDeck().getAttribute('data-visible-slide-count')).toBe('6');
  });

  it('every distinct slide is uniquely identifiable as it becomes current', () => {
    const { rerender } = render(
      <SlideDeck moonEnabled events={[AURORA_TODAY, PERSEIDS_TODAY]} />,
    );
    const expectedIds = [
      'today',
      'seven-day',
      'current',
      'moon',
      'event:aurora',
      'event:meteor:Perseids',
      'settings',
    ];
    for (let i = 0; i < expectedIds.length; i++) {
      const id = expectedIds[i];
      if (i > 0) fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
      rerender(
        <SlideDeck moonEnabled events={[AURORA_TODAY, PERSEIDS_TODAY]} />,
      );
      expect(getDeck().getAttribute('data-current-slide-id')).toBe(id);
      expect(screen.getByTestId(`slide-${id}`)).toBeInTheDocument();
    }
  });

  it('event slides render between the moon (or current) slide and settings', () => {
    render(<SlideDeck moonEnabled events={[AURORA_TODAY]} />);
    // Advance to the event slide: today → seven-day → current → moon → aurora.
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    }
    expect(getDeck().getAttribute('data-current-slide-id')).toBe(
      'event:aurora',
    );
    // Next arrow → settings (event sits immediately before settings).
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
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
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('2');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-prev'));
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('1');
    expect(getDeck().getAttribute('data-direction')).toBe('prev');
  });

  it('right arrow at the last slide wraps to the first (same direction, no reverse-spin)', () => {
    render(<SlideDeck />);
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
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
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('3');

    rerender(<SlideDeck moonEnabled />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('settings');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('4');
  });

  it('user on today stays on today when an event becomes active', () => {
    const { rerender } = render(<SlideDeck events={[]} />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    rerender(<SlideDeck events={[AURORA_TODAY]} />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('today');
    expect(getDeck().getAttribute('data-current-slide-index')).toBe('0');
  });

  it('user on an event slide falls back to current when events disappear', () => {
    const { rerender } = render(<SlideDeck events={[AURORA_TODAY]} />);
    // 5 visible slides: today, seven-day, current, event:aurora, settings.
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // seven-day
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // current
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next')); // event:aurora
    expect(getDeck().getAttribute('data-current-slide-id')).toBe(
      'event:aurora',
    );

    rerender(<SlideDeck events={[]} />);
    expect(getDeck().getAttribute('data-current-slide-id')).toBe('current');
  });
});
