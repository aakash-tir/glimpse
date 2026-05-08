import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

// Pin window.innerWidth to the default Electron window size so the
// responsive visible-cell count is deterministic across tests.
// jsdom defaults to 1024 which would produce 8 visible cells (the
// hourly max) and break the assertions tuned to default-size layout.
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    value: 240,
    configurable: true,
    writable: true,
  });
});

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

  it('keeps the "Today" title visible during the loading skeleton', () => {
    render(<TodaySlide forecast={null} timeFormat="24h" />);
    const title = screen.getByTestId('slide-title');
    expect(title.getAttribute('data-slide-title')).toBe('Today');
    expect(title).toHaveTextContent('Today');
  });
});

describe('TodaySlide — title', () => {
  it('renders a "Today" title at the top of the slide once data is loaded', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const title = screen.getByTestId('slide-title');
    expect(title).toHaveTextContent('Today');
  });
});

describe('TodaySlide — hourly content', () => {
  it('renders 24 hour cells with no page wrapper (matches plan/slides.md snap-to-cell)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    expect(screen.getAllByTestId('hourly-cell')).toHaveLength(24);
    // Page-wrapper testid removed — each cell is now its own snap
    // target so a scroll advances one hour, not six.
    expect(screen.queryAllByTestId('hourly-page')).toHaveLength(0);
  });

  it('reports 24 items / 5 visible per page on the slide wrapper', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    expect(content.getAttribute('data-item-count')).toBe('24');
    expect(content.getAttribute('data-visible-per-page')).toBe('5');
  });

  it('reports the side-padding so the slide has breathing room from the panel edges', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    expect(content.getAttribute('data-side-padding-px')).toBe('12');
  });

  it('reserves space at the bottom of the body for the slide-deck nav bar', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    // SlideShell exposes the reserve so vertically-centered cells land
    // in the middle of the visible (non-nav-bar) area.
    expect(
      screen.getByTestId('slide-body').getAttribute('data-bottom-reserved-px'),
    ).toBe('36');
  });

  it('vertically centers the cell content (justify-content: center)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const cell = screen.getAllByTestId('hourly-cell')[0]!;
    expect(cell.style.justifyContent).toBe('center');
  });
});

describe('TodaySlide — responsive visible cell count', () => {
  it('renders 5 cells at the default 240 px window', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 240,
      configurable: true,
      writable: true,
    });
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    // round((240 - 24) / 48) = round(4.5) = 5.
    expect(content.getAttribute('data-visible-per-page')).toBe('5');
  });

  it('renders more cells on a wider window', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 360,
      configurable: true,
      writable: true,
    });
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    // round((360 - 24) / 48) = 7.
    expect(content.getAttribute('data-visible-per-page')).toBe('7');
  });

  it('clamps to the maximum visible-cell count on huge windows', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 800,
      configurable: true,
      writable: true,
    });
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    // round((800 - 24) / 48) = 16, clamped to max 8.
    expect(content.getAttribute('data-visible-per-page')).toBe('8');
  });

  it('clamps to the minimum visible-cell count on tiny windows', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 120,
      configurable: true,
      writable: true,
    });
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const content = screen.getByTestId('slide-today-content');
    // round((120 - 24) / 48) = 2, clamped to min 3.
    expect(content.getAttribute('data-visible-per-page')).toBe('3');
  });

  it('each cell has scroll-snap-align: start and a flex basis matching the responsive count', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const cells = screen.getAllByTestId('hourly-cell');
    for (const cell of cells) {
      expect(cell.style.scrollSnapAlign).toBe('start');
      // At the pinned default 240 px window: 5 visible per page →
      // calc(100% / 5), which jsdom canonicalizes to calc(20%).
      expect(cell.style.flexBasis).toMatch(/^calc\((?:100%\s*\/\s*5|20%)\)$/);
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

describe('TodaySlide — wheel-to-horizontal scroll', () => {
  function stubClientWidth(track: HTMLElement, value: number): void {
    Object.defineProperty(track, 'clientWidth', {
      value,
      configurable: true,
    });
    Object.defineProperty(track, 'scrollLeft', {
      value: 0,
      writable: true,
      configurable: true,
    });
  }

  it('a downward wheel notch advances exactly one cell width (1/5 of viewport)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    // 240 px track inner width → 48 px per cell on the hourly slide.
    stubClientWidth(track, 240);
    const e = new WheelEvent('wheel', {
      deltaY: 200,
      deltaX: 0,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      track.dispatchEvent(e);
    });
    // 200 px raw deltaY is ignored — only the sign matters.
    expect(track.scrollLeft).toBe(48);
  });

  it('a small wheel delta still advances a full cell (sign-based, not magnitude)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    stubClientWidth(track, 240);
    const e = new WheelEvent('wheel', {
      deltaY: 5,
      deltaX: 0,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      track.dispatchEvent(e);
    });
    expect(track.scrollLeft).toBe(48);
  });

  it('an upward wheel notch retreats exactly one cell width', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    stubClientWidth(track, 240);
    track.scrollLeft = 144; // start at cell 3 (3 × 48)
    const e = new WheelEvent('wheel', {
      deltaY: -100,
      deltaX: 0,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      track.dispatchEvent(e);
    });
    expect(track.scrollLeft).toBe(96);
  });

  it('leaves a predominantly-horizontal wheel event alone (trackpad gesture)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const track = screen.getByTestId('scroll-track');
    stubClientWidth(track, 240);
    const e = new WheelEvent('wheel', {
      deltaY: 30,
      deltaX: 200,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      track.dispatchEvent(e);
    });
    // We did not redirect, so scrollLeft remains untouched. Browsers
    // would scroll horizontally on their own from the deltaX.
    expect(track.scrollLeft).toBe(0);
  });
});

describe('TodaySlide — edge fade is white-tinted (scrollability cue)', () => {
  it('applies a semi-transparent white gradient to the right edge fade', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    const right = screen.getByTestId('edge-fade-right');
    // Plan/slides.md: white edge-fade highlights the scrollable side.
    // Match a "255, 255, 255" rgba pattern in the gradient string.
    expect(right.style.background).toMatch(/255,\s*255,\s*255/);
  });

  it('does not render a progress bar (replaced by the white edge fade)', () => {
    render(<TodaySlide forecast={buildForecast()} timeFormat="24h" />);
    expect(screen.queryByTestId('scroll-progress')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('scroll-progress-thumb'),
    ).not.toBeInTheDocument();
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
