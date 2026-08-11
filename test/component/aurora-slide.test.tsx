import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  AURORA_SHIMMER_DURATION_S,
  AuroraSlide,
} from '../../src/renderer/src/components/aurora-slide';
import type { AuroraEvent } from '../../src/shared/special-events';

afterEach(cleanup);

const AURORA: AuroraEvent = {
  type: 'aurora',
  id: 'event:aurora',
  dayOffset: 0,
  kp: 5.7,
  latitude: 65,
  visibilityText: 'Visible from your location',
};

describe('AuroraSlide — content', () => {
  it('renders the title "Aurora"', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    expect(screen.getByTestId('slide-title').textContent).toBe('Aurora');
  });

  it('renders the Kp value rounded to 1 decimal', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    const kp = screen.getByTestId('aurora-kp');
    expect(kp.textContent).toBe('5.7');
    expect(kp.getAttribute('data-kp')).toBe('5.7');
  });

  it('trims trailing ".0" on integer Kp values', () => {
    render(
      <AuroraSlide
        event={{ ...AURORA, kp: 6 }}
        timeFormat="24h"
        timeZone={null}
        lastUpdated={null}
      />,
    );
    expect(screen.getByTestId('aurora-kp').textContent).toBe('6');
  });

  it('renders the visibility text from the event payload', () => {
    render(
      <AuroraSlide
        event={{ ...AURORA, visibilityText: 'Visible at latitudes ≥ 50°' }}
        timeFormat="24h"
        timeZone={null}
        lastUpdated={null}
      />,
    );
    expect(screen.getByTestId('aurora-visibility').textContent).toBe(
      'Visible at latitudes ≥ 50°',
    );
  });

  it('renders the last-updated time in 24h when timeFormat is "24h"', () => {
    // 14:30 UTC → varies by tz, but the local-clock format is the same
    // shape; assert just on the HH:MM regex.
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        timeZone={null}
        lastUpdated="2026-05-09T14:30:00Z"
      />,
    );
    const el = screen.getByTestId('aurora-last-updated');
    expect(el.textContent).toMatch(/^Updated \d{2}:\d{2}$/);
  });

  it('renders the last-updated time in 12h with AM/PM when timeFormat is "12h"', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="12h"
        timeZone={null}
        lastUpdated="2026-05-09T14:30:00Z"
      />,
    );
    const el = screen.getByTestId('aurora-last-updated');
    expect(el.textContent).toMatch(/^Updated \d{1,2}:\d{2} (AM|PM)$/);
  });

  it('omits the last-updated row when no lastUpdated value is supplied', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    expect(screen.queryByTestId('aurora-last-updated')).toBeNull();
  });
});

describe('AuroraSlide — background + motion', () => {
  it('renders the gradient background overlay', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    const bg = screen.getByTestId('aurora-bg-gradient');
    expect(bg).toBeInTheDocument();
    // Spec gradient endpoints: #0a2e1f → #2a0a3e.
    expect(bg.style.background).toMatch(/#0a2e1f/);
    expect(bg.style.background).toMatch(/#2a0a3e/);
  });

  it('renders the shimmer motion overlay with the spec-required duration', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    const shimmer = screen.getByTestId('aurora-shimmer');
    expect(shimmer).toBeInTheDocument();
    // Plan/styling.md: "Slow shimmer drift, ~30 s loop".
    expect(shimmer.getAttribute('data-shimmer-duration-s')).toBe(
      String(AURORA_SHIMMER_DURATION_S),
    );
    expect(AURORA_SHIMMER_DURATION_S).toBe(30);
  });

  it('does not render the Tomorrow badge (aurora is today-only)', () => {
    render(
      <AuroraSlide
        event={AURORA}
        timeFormat="24h"
        lastUpdated={null}
        timeZone={null}
      />,
    );
    expect(screen.queryByTestId('event-tomorrow-badge-aurora')).toBeNull();
    expect(
      screen
        .getByTestId('event-slide-aurora')
        .getAttribute('data-event-tomorrow'),
    ).toBe('off');
  });
});
