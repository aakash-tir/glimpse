import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BloodMoonSlide } from '../../src/renderer/src/components/blood-moon-slide';
import type { BloodMoonEvent } from '../../src/shared/special-events';

afterEach(cleanup);

const BLOOD_MOON_TODAY: BloodMoonEvent = {
  type: 'blood-moon',
  id: 'event:blood-moon:2028-12-31',
  dayOffset: 0,
  eclipse: {
    date: '2028-12-31',
    type: 'total-lunar',
    peakTimeUtc: '2028-12-31T16:53:00Z',
    visibility: 'Visible from: Europe, Africa, Asia, Australia',
    magnitude: 1.25,
  },
};

const BLOOD_MOON_TOMORROW: BloodMoonEvent = {
  ...BLOOD_MOON_TODAY,
  dayOffset: 1,
};

const BLOOD_MOON_MINIMAL: BloodMoonEvent = {
  type: 'blood-moon',
  id: 'event:blood-moon:2028-12-31',
  dayOffset: 0,
  eclipse: { date: '2028-12-31', type: 'total-lunar' },
};

describe('BloodMoonSlide — content', () => {
  it('renders the title "Blood moon"', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="24h" />);
    expect(screen.getByTestId('slide-title').textContent).toBe('Blood moon');
  });

  it('renders the peak time in 24h format', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="24h" />);
    expect(screen.getByTestId('blood-moon-peak-time').textContent).toMatch(
      /^Peak \d{2}:\d{2}$/,
    );
  });

  it('renders the peak time in 12h format with AM/PM', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="12h" />);
    expect(screen.getByTestId('blood-moon-peak-time').textContent).toMatch(
      /^Peak \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it('renders the visibility text from the eclipse JSON', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="24h" />);
    expect(screen.getByTestId('blood-moon-visibility').textContent).toBe(
      'Visible from: Europe, Africa, Asia, Australia',
    );
  });

  it('omits optional rows when the eclipse JSON has no peak/visibility', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_MINIMAL} timeFormat="24h" />);
    expect(screen.getByTestId('slide-title').textContent).toBe('Blood moon');
    expect(screen.queryByTestId('blood-moon-peak-time')).toBeNull();
    expect(screen.queryByTestId('blood-moon-visibility')).toBeNull();
  });
});

describe('BloodMoonSlide — background + motion', () => {
  it('renders the dark-glass window tint and a centred blood-moon disc', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="24h" />);
    const tint = screen.getByTestId('blood-moon-bg-tint');
    expect(tint).toBeInTheDocument();
    // Same translucent slate glass as the weather slides.
    expect(tint.style.background).toMatch(/rgba\(15,\s*23,\s*42/);
    // Faint blood-moon disc layered on top.
    expect(screen.getByTestId('blood-moon-disc')).toBeInTheDocument();
  });
});

describe('BloodMoonSlide — Tomorrow badge', () => {
  it('omits the Tomorrow badge when dayOffset is 0', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TODAY} timeFormat="24h" />);
    expect(screen.queryByTestId('event-tomorrow-badge-blood-moon')).toBeNull();
  });

  it('renders the Tomorrow badge when dayOffset is 1', () => {
    render(<BloodMoonSlide event={BLOOD_MOON_TOMORROW} timeFormat="24h" />);
    const badge = screen.getByTestId('event-tomorrow-badge-blood-moon');
    expect(badge.textContent).toBe('Tomorrow');
    expect(
      screen
        .getByTestId('event-slide-blood-moon')
        .getAttribute('data-event-tomorrow'),
    ).toBe('on');
  });
});
