import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  ECLIPSE_PULSE_AMPLITUDE,
  ECLIPSE_PULSE_DURATION_S,
  EclipseSlide,
} from '../../src/renderer/src/components/eclipse-slide';
import type { EclipseEvent } from '../../src/shared/special-events';

afterEach(cleanup);

// Total-lunar eclipses route to the blood-moon slide now, so the
// eclipse slide's representative fixture is a solar eclipse.
const SOLAR_TODAY: EclipseEvent = {
  type: 'eclipse',
  id: 'event:eclipse:2028-12-31',
  dayOffset: 0,
  eclipse: {
    date: '2028-12-31',
    type: 'total-solar',
    peakTimeUtc: '2028-12-31T16:53:00Z',
    visibility: 'Visible from: Europe, Africa, Asia, Australia',
    magnitude: 1.25,
  },
};

const PARTIAL_TOMORROW: EclipseEvent = {
  type: 'eclipse',
  id: 'event:eclipse:2026-08-28',
  dayOffset: 1,
  eclipse: {
    date: '2026-08-28',
    type: 'partial-lunar',
    peakTimeUtc: '2026-08-28T04:13:00Z',
    visibility: 'Visible from: Americas, Pacific',
    magnitude: 0.93,
  },
};

const MINIMAL_ECLIPSE: EclipseEvent = {
  type: 'eclipse',
  id: 'event:eclipse:2027-02-06',
  dayOffset: 0,
  eclipse: { date: '2027-02-06', type: 'annular-solar' },
};

describe('EclipseSlide — content', () => {
  it('renders the spec-formatted type label as the title', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.getByTestId('slide-title').textContent).toBe(
      'Total solar eclipse',
    );
  });

  it('renders the peak time in 24h format', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.getByTestId('eclipse-peak-time').textContent).toMatch(
      /^Peak \d{2}:\d{2}$/,
    );
  });

  it('renders the peak time in 12h format with AM/PM', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="12h" timeZone={null} />,
    );
    expect(screen.getByTestId('eclipse-peak-time').textContent).toMatch(
      /^Peak \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it('renders the visibility text from the JSON entry', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.getByTestId('eclipse-visibility').textContent).toBe(
      'Visible from: Europe, Africa, Asia, Australia',
    );
  });

  it('renders the magnitude as a percentage', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    const mag = screen.getByTestId('eclipse-magnitude');
    expect(mag.textContent).toBe('Magnitude 125%');
    expect(mag.getAttribute('data-magnitude')).toBe('1.25');
  });

  it('omits optional rows when the JSON entry has no peak/visibility/magnitude', () => {
    render(
      <EclipseSlide event={MINIMAL_ECLIPSE} timeFormat="24h" timeZone={null} />,
    );
    // Title still renders.
    expect(screen.getByTestId('slide-title').textContent).toBe(
      'Annular solar eclipse',
    );
    expect(screen.queryByTestId('eclipse-peak-time')).toBeNull();
    expect(screen.queryByTestId('eclipse-visibility')).toBeNull();
    expect(screen.queryByTestId('eclipse-magnitude')).toBeNull();
    expect(screen.queryByTestId('eclipse-start-end')).toBeNull();
  });

  it('renders the start/end row only when both times are present', () => {
    render(
      <EclipseSlide
        event={{
          ...SOLAR_TODAY,
          eclipse: {
            ...SOLAR_TODAY.eclipse,
            startTimeUtc: '2028-12-31T15:08:00Z',
            endTimeUtc: '2028-12-31T18:38:00Z',
          },
        }}
        timeFormat="24h"
        timeZone={null}
      />,
    );
    expect(screen.getByTestId('eclipse-start-end').textContent).toMatch(
      /^\d{2}:\d{2} – \d{2}:\d{2}$/,
    );
  });
});

describe('EclipseSlide — background + motion', () => {
  it('renders the radial gradient background with the spec-required pulse', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    const pulse = screen.getByTestId('eclipse-bg-pulse');
    expect(pulse).toBeInTheDocument();
    expect(pulse.style.background).toMatch(/#1a0a0a/);
    expect(pulse.style.background).toMatch(/#2a1010/);
    // Plan: 4 s period, ±5 % amplitude.
    expect(pulse.getAttribute('data-pulse-duration-s')).toBe(
      String(ECLIPSE_PULSE_DURATION_S),
    );
    expect(pulse.getAttribute('data-pulse-amplitude')).toBe(
      String(ECLIPSE_PULSE_AMPLITUDE),
    );
    expect(ECLIPSE_PULSE_DURATION_S).toBe(4);
    expect(ECLIPSE_PULSE_AMPLITUDE).toBeCloseTo(0.05);
  });

  it('renders the eclipse silhouette disc', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.getByTestId('eclipse-disc')).toBeInTheDocument();
  });
});

describe('EclipseSlide — Tomorrow badge', () => {
  it('omits the Tomorrow badge when dayOffset is 0', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.queryByTestId('event-tomorrow-badge-eclipse')).toBeNull();
  });

  it('renders the Tomorrow badge when dayOffset is 1', () => {
    render(
      <EclipseSlide
        event={PARTIAL_TOMORROW}
        timeFormat="24h"
        timeZone={null}
      />,
    );
    const badge = screen.getByTestId('event-tomorrow-badge-eclipse');
    expect(badge.textContent).toBe('Tomorrow');
    expect(
      screen
        .getByTestId('event-slide-eclipse')
        .getAttribute('data-event-tomorrow'),
    ).toBe('on');
  });
});

describe('EclipseSlide — times render in the forecast zone', () => {
  // plan/slides.md § Time rendering. SOLAR_TODAY peaks at 16:53Z.
  it('shows the peak in the passed zone, not the host zone', () => {
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone="UTC" />,
    );
    expect(screen.getByTestId('eclipse-peak-time').textContent).toBe(
      'Peak 16:53',
    );
    cleanup();
    // UTC+9 pushes it past midnight into the next calendar day.
    render(
      <EclipseSlide
        event={SOLAR_TODAY}
        timeFormat="24h"
        timeZone="Asia/Tokyo"
      />,
    );
    expect(screen.getByTestId('eclipse-peak-time').textContent).toBe(
      'Peak 01:53',
    );
  });

  it('falls back to the host zone when no forecast zone is known', () => {
    const d = new Date('2028-12-31T16:53:00Z');
    const hostClock = `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
    render(
      <EclipseSlide event={SOLAR_TODAY} timeFormat="24h" timeZone={null} />,
    );
    expect(screen.getByTestId('eclipse-peak-time').textContent).toBe(
      `Peak ${hostClock}`,
    );
  });
});
