import { afterEach, describe, expect, it } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { Condition } from '../../src/shared/condition';
import type { Forecast } from '../../src/shared/forecast';
import { TodaySlide } from '../../src/renderer/src/components/today-slide';

afterEach(cleanup);

// Build a deterministic 48-hour forecast spanning 2 days, with a clear
// daytime block in the middle. Hourly entries are sequential so the
// rolling-window selector picks 24 consecutive entries.
function buildForecast(): Forecast {
  const hourly = [];
  for (let day = 3; day <= 4; day++) {
    for (let h = 0; h < 24; h++) {
      const dd = String(day).padStart(2, '0');
      const hh = String(h).padStart(2, '0');
      hourly.push({
        time: `2026-05-${dd}T${hh}:00`,
        temperature: 10 + h * 0.5,
        weatherCode: 0,
        condition: 'clear' as Condition,
        precipitationProbability: h * 2,
      });
    }
  }
  return {
    timezone: 'America/Los_Angeles',
    current: {
      time: '2026-05-03T08:23',
      temperature: 14.6,
      apparentTemperature: 13.2,
      humidity: 72,
      weatherCode: 0,
      condition: 'clear',
      windSpeed: 9.3,
      windDirection: 220,
      precipitation: 0,
    },
    hourly,
    daily: [
      {
        date: '2026-05-03',
        weatherCode: 0,
        condition: 'clear',
        high: 22,
        low: 9,
        precipitationProbability: 5,
        sunrise: '2026-05-03T06:15',
        sunset: '2026-05-03T20:10',
      },
      {
        date: '2026-05-04',
        weatherCode: 0,
        condition: 'clear',
        high: 22,
        low: 9,
        precipitationProbability: 5,
        sunrise: '2026-05-04T06:14',
        sunset: '2026-05-04T20:11',
      },
    ],
  };
}

describe('TodaySlide — loading skeleton', () => {
  it('renders the hourly skeleton when forecast is null', () => {
    render(<TodaySlide forecast={null} timeFormat="24h" />);
    expect(screen.getByTestId('loading-skeleton-hourly')).toBeInTheDocument();
    // Real content is absent.
    expect(screen.queryByTestId('slide-today-content')).not.toBeInTheDocument();
  });
});

describe('TodaySlide — hourly content', () => {
  it('renders 24 hour cells across 4 pages of 6 (matches plan/slides.md 6/page snap)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    expect(screen.getAllByTestId('hourly-cell')).toHaveLength(24);
    const pages = screen.getAllByTestId('hourly-page');
    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(page.getAttribute('data-cells-per-page')).toBe('6');
    }
  });

  it('starts at the next full hour after forecast.current.time', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    // current.time is 08:23 → first cell is 09:00.
    const cells = screen.getAllByTestId('hourly-cell');
    expect(cells[0]?.getAttribute('data-hour-time')).toBe('2026-05-03T09:00');
    // Last cell is 24 hours later → 2026-05-04T08:00.
    expect(cells[23]?.getAttribute('data-hour-time')).toBe('2026-05-04T08:00');
  });

  it('respects the now override prop for deterministic rendering', () => {
    render(
      <TodaySlide
        forecast={buildForecast()}
        timeFormat="24h"
        now="2026-05-03T13:00"
      />,
    );
    const cells = screen.getAllByTestId('hourly-cell');
    expect(cells[0]?.getAttribute('data-hour-time')).toBe('2026-05-03T14:00');
  });
});

describe('TodaySlide — day/night icon variant', () => {
  it('uses the day glyph for an hour between sunrise and sunset', () => {
    // Force the rolling window to start at 12:00 — squarely between
    // 06:15 sunrise and 20:10 sunset.
    render(
      <TodaySlide
        forecast={buildForecast()}
        timeFormat="24h"
        now="2026-05-03T11:00"
      />,
    );
    const noon = screen.getAllByTestId('hourly-cell')[0];
    expect(noon?.getAttribute('data-hour-time')).toBe('2026-05-03T12:00');
    expect(noon?.getAttribute('data-is-day')).toBe('on');
    expect(noon?.getAttribute('data-glyph')).toBe('WiDaySunny');
  });

  it('uses the night glyph for an hour after sunset', () => {
    render(
      <TodaySlide
        forecast={buildForecast()}
        timeFormat="24h"
        now="2026-05-03T20:00"
      />,
    );
    // sunset = 20:10, so 21:00 is night.
    const cells = screen.getAllByTestId('hourly-cell');
    const cell9pm = cells.find(
      (c) => c.getAttribute('data-hour-time') === '2026-05-03T21:00',
    );
    expect(cell9pm?.getAttribute('data-is-day')).toBe('off');
    expect(cell9pm?.getAttribute('data-glyph')).toBe('WiNightClear');
  });
});

describe('TodaySlide — time format', () => {
  it('renders 24h times by default', () => {
    render(
      <TodaySlide
        forecast={buildForecast()}
        timeFormat="24h"
        now="2026-05-03T08:23"
      />,
    );
    // First visible page: 09:00..14:00 in 24h.
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
  });

  it('re-renders times when the timeFormat prop flips to 12h', () => {
    const f = buildForecast();
    const { rerender } = render(
      <TodaySlide forecast={f} timeFormat="24h" now="2026-05-03T08:23" />,
    );
    expect(screen.getByText('13:00')).toBeInTheDocument();
    rerender(
      <TodaySlide forecast={f} timeFormat="12h" now="2026-05-03T08:23" />,
    );
    expect(screen.queryByText('13:00')).not.toBeInTheDocument();
    expect(screen.getByText('1 PM')).toBeInTheDocument();
    expect(screen.getByText('9 AM')).toBeInTheDocument();
  });
});

describe('TodaySlide — edge-fade affordance', () => {
  // jsdom doesn't compute layout — the scroll-track's clientWidth /
  // scrollWidth default to 0. Stub them so the visibility logic in
  // ScrollableSlide can react to scroll position the way it does in
  // a real browser.
  function stubScrollMetrics(
    track: HTMLElement,
    metrics: { clientWidth: number; scrollWidth: number; scrollLeft: number },
  ): void {
    Object.defineProperty(track, 'clientWidth', {
      value: metrics.clientWidth,
      configurable: true,
    });
    Object.defineProperty(track, 'scrollWidth', {
      value: metrics.scrollWidth,
      configurable: true,
    });
    Object.defineProperty(track, 'scrollLeft', {
      value: metrics.scrollLeft,
      writable: true,
      configurable: true,
    });
  }

  it('shows the right fade and hides the left fade at scrollLeft = 0', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    // 4 pages, page width 240, so scrollWidth = 960 and clientWidth = 240.
    stubScrollMetrics(track, {
      clientWidth: 240,
      scrollWidth: 960,
      scrollLeft: 0,
    });
    act(() => {
      fireEvent.scroll(track);
    });
    expect(
      screen.getByTestId('edge-fade-left').getAttribute('data-visible'),
    ).toBe('off');
    expect(
      screen.getByTestId('edge-fade-right').getAttribute('data-visible'),
    ).toBe('on');
  });

  it('shows both fades mid-scroll', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    stubScrollMetrics(track, {
      clientWidth: 240,
      scrollWidth: 960,
      scrollLeft: 240,
    });
    act(() => {
      fireEvent.scroll(track);
    });
    expect(
      screen.getByTestId('edge-fade-left').getAttribute('data-visible'),
    ).toBe('on');
    expect(
      screen.getByTestId('edge-fade-right').getAttribute('data-visible'),
    ).toBe('on');
  });

  it('hides the right fade and shows the left fade at the scroll end', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    stubScrollMetrics(track, {
      clientWidth: 240,
      scrollWidth: 960,
      scrollLeft: 720, // 960 - 240
    });
    act(() => {
      fireEvent.scroll(track);
    });
    expect(
      screen.getByTestId('edge-fade-left').getAttribute('data-visible'),
    ).toBe('on');
    expect(
      screen.getByTestId('edge-fade-right').getAttribute('data-visible'),
    ).toBe('off');
  });
});
