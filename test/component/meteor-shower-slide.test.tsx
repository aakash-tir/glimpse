import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  MeteorShowerSlide,
  SHOOTING_STAR_DURATION_S,
  SHOOTING_STAR_INTERVAL_S,
} from '../../src/renderer/src/components/meteor-shower-slide';
import type { MeteorEvent } from '../../src/shared/special-events';

afterEach(cleanup);

const PERSEIDS_TODAY: MeteorEvent = {
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

const PERSEIDS_TOMORROW: MeteorEvent = {
  ...PERSEIDS_TODAY,
  dayOffset: 1,
};

describe('MeteorShowerSlide — content', () => {
  it('renders the title with the shower name', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    expect(screen.getByTestId('slide-title').textContent).toBe(
      'Perseids meteor shower',
    );
  });

  it('renders the peak date in human-friendly form', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    expect(screen.getByTestId('meteor-peak-date').textContent).toBe(
      'Peak: Aug 12',
    );
  });

  it('renders the ZHR value', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const zhr = screen.getByTestId('meteor-zhr');
    expect(zhr.textContent).toBe('ZHR ≈ 100');
    expect(zhr.getAttribute('data-zhr')).toBe('100');
  });

  it('renders the best viewing time', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    expect(screen.getByTestId('meteor-viewing-time').textContent).toBe(
      'Late night to pre-dawn',
    );
  });
});

describe('MeteorShowerSlide — background + motion', () => {
  it('renders the solid background', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const bg = screen.getByTestId('meteor-bg-solid');
    expect(bg).toBeInTheDocument();
    // Spec colour: #0a0a1f (rgb(10, 10, 31)).
    expect(bg.style.background).toMatch(/#0a0a1f|rgb\(10,\s*10,\s*31\)/);
  });

  it('renders 30–40 static white star points', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const field = screen.getByTestId('meteor-star-field');
    const count = Number(field.getAttribute('data-star-count'));
    expect(count).toBeGreaterThanOrEqual(30);
    expect(count).toBeLessThanOrEqual(40);
    expect(field.querySelectorAll('circle').length).toBe(count);
  });

  it('produces a deterministic star field across re-renders (seeded by name)', () => {
    const { rerender } = render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const firstX = Array.from(
      screen
        .getByTestId('meteor-star-field')
        .querySelectorAll<SVGCircleElement>('circle'),
    ).map((c) => c.getAttribute('cx'));
    rerender(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const secondX = Array.from(
      screen
        .getByTestId('meteor-star-field')
        .querySelectorAll<SVGCircleElement>('circle'),
    ).map((c) => c.getAttribute('cx'));
    expect(secondX).toEqual(firstX);
  });

  it('renders the shooting-star overlay with spec-required cadence', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    const star = screen.getByTestId('meteor-shooting-star');
    expect(star).toBeInTheDocument();
    // Plan: ~1 every 6 s, 0.6 s trajectory.
    expect(star.getAttribute('data-shooting-interval-s')).toBe(
      String(SHOOTING_STAR_INTERVAL_S),
    );
    expect(star.getAttribute('data-shooting-duration-s')).toBe(
      String(SHOOTING_STAR_DURATION_S),
    );
    expect(SHOOTING_STAR_INTERVAL_S).toBe(6);
    expect(SHOOTING_STAR_DURATION_S).toBeCloseTo(0.6);
  });
});

describe('MeteorShowerSlide — Tomorrow badge', () => {
  it('omits the Tomorrow badge when dayOffset is 0', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TODAY} />);
    expect(
      screen.queryByTestId('event-tomorrow-badge-meteor-shower'),
    ).toBeNull();
    expect(
      screen
        .getByTestId('event-slide-meteor-shower')
        .getAttribute('data-event-tomorrow'),
    ).toBe('off');
  });

  it('renders the Tomorrow badge when dayOffset is 1', () => {
    render(<MeteorShowerSlide event={PERSEIDS_TOMORROW} />);
    const badge = screen.getByTestId('event-tomorrow-badge-meteor-shower');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('Tomorrow');
    expect(
      screen
        .getByTestId('event-slide-meteor-shower')
        .getAttribute('data-event-tomorrow'),
    ).toBe('on');
  });
});
