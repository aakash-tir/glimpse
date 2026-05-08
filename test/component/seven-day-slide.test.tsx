import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Condition } from '../../src/shared/condition';
import type { Forecast, ForecastDay } from '../../src/shared/forecast';
import { SevenDaySlide } from '../../src/renderer/src/components/seven-day-slide';

afterEach(cleanup);

function day(
  date: string,
  cond: Condition = 'clear',
  high = 22,
  low = 9,
  pop = 5,
): ForecastDay {
  return {
    date,
    weatherCode: 0,
    condition: cond,
    high,
    low,
    precipitationProbability: pop,
    sunrise: `${date}T06:00`,
    sunset: `${date}T20:00`,
  };
}

function buildForecast(): Forecast {
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
    hourly: [],
    // 2026-05-03 is a Sunday → forecast.daily[1..6] are Mon..Sat.
    daily: [
      day('2026-05-03', 'clear'),
      day('2026-05-04', 'partly-cloudy'),
      day('2026-05-05', 'rain'),
      day('2026-05-06', 'cloudy'),
      day('2026-05-07', 'thunderstorm'),
      day('2026-05-08', 'snow'),
      day('2026-05-09', 'fog'),
    ],
  };
}

describe('SevenDaySlide — loading skeleton', () => {
  it('renders the seven-day skeleton when forecast is null', () => {
    render(<SevenDaySlide forecast={null} />);
    expect(
      screen.getByTestId('loading-skeleton-seven-day'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('slide-seven-day-content'),
    ).not.toBeInTheDocument();
  });

  it('keeps the "Next 7 days" title visible during the loading skeleton', () => {
    render(<SevenDaySlide forecast={null} />);
    const title = screen.getByTestId('slide-title');
    expect(title.getAttribute('data-slide-title')).toBe('Next 7 days');
    expect(title).toHaveTextContent('Next 7 days');
  });
});

describe('SevenDaySlide — title', () => {
  it('renders a "Next 7 days" title at the top of the slide once data is loaded', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const title = screen.getByTestId('slide-title');
    expect(title).toHaveTextContent('Next 7 days');
  });
});

describe('SevenDaySlide — content', () => {
  it('renders today + next 6 days = 7 rows', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    expect(screen.getAllByTestId('seven-day-cell')).toHaveLength(7);
  });

  it('renders cells with no page wrapper (matches plan/slides.md snap-to-cell)', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    expect(screen.queryAllByTestId('seven-day-page')).toHaveLength(0);
  });

  it('reports 7 items / 3 visible per page on the slide wrapper', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const content = screen.getByTestId('slide-seven-day-content');
    expect(content.getAttribute('data-item-count')).toBe('7');
    expect(content.getAttribute('data-visible-per-page')).toBe('3');
  });

  it('each cell has scroll-snap-align: start and a 1/3 flex basis', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const cells = screen.getAllByTestId('seven-day-cell');
    for (const cell of cells) {
      expect(cell.style.scrollSnapAlign).toBe('start');
      // jsdom canonicalizes `calc(100% / 3)` to `calc(33.3333%)`.
      expect(cell.style.flexBasis).toMatch(
        /^calc\((?:100%\s*\/\s*3|33\.3333%)\)$/,
      );
    }
  });

  it('row 1 is labeled "Today"', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const cells = screen.getAllByTestId('seven-day-cell');
    expect(cells[0]?.getAttribute('data-day-label')).toBe('Today');
    expect(cells[0]?.getAttribute('data-day-date')).toBe('2026-05-03');
  });

  it('rows 2..7 use weekday abbreviations Mon..Sat', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const cells = screen.getAllByTestId('seven-day-cell');
    expect(cells.slice(1).map((c) => c.getAttribute('data-day-label'))).toEqual(
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    );
  });

  it('uses the daytime condition glyph for every row', () => {
    render(<SevenDaySlide forecast={buildForecast()} />);
    const cells = screen.getAllByTestId('seven-day-cell');
    // Spot-check a few: clear → WiDaySunny, rain → WiDayRain, snow → WiDaySnow.
    expect(cells[0]?.getAttribute('data-glyph')).toBe('WiDaySunny');
    expect(cells[2]?.getAttribute('data-glyph')).toBe('WiDayRain');
    expect(cells[5]?.getAttribute('data-glyph')).toBe('WiDaySnow');
  });

  it('renders high / low temperatures and precipitation %', () => {
    const f = buildForecast();
    f.daily[0] = day('2026-05-03', 'clear', 24, 11, 30);
    render(<SevenDaySlide forecast={f} />);
    expect(screen.getByText('24° / 11°')).toBeInTheDocument();
    // 30% appears multiple times for unrelated days; assert presence in
    // today's cell specifically.
    const todayCell = screen.getAllByTestId('seven-day-cell')[0];
    expect(todayCell?.textContent).toContain('30%');
  });

  it('caps at 7 rows even if forecast.daily has more entries', () => {
    const f = buildForecast();
    // Extend with extra days; the slide should ignore them.
    f.daily.push(day('2026-05-10'), day('2026-05-11'));
    render(<SevenDaySlide forecast={f} />);
    expect(screen.getAllByTestId('seven-day-cell')).toHaveLength(7);
  });
});
