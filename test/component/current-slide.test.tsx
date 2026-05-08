import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Condition } from '../../src/shared/condition';
import type { Forecast, ForecastDay } from '../../src/shared/forecast';
import { CurrentSlide } from '../../src/renderer/src/components/current-slide';

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
    sunrise: `${date}T06:14`,
    sunset: `${date}T20:42`,
  };
}

function buildForecast(overrides?: {
  windDirection?: number;
  windSpeed?: number;
  humidity?: number;
  apparentTemperature?: number;
}): Forecast {
  return {
    timezone: 'America/Los_Angeles',
    current: {
      time: '2026-05-03T08:23',
      temperature: 14.6,
      apparentTemperature: overrides?.apparentTemperature ?? 13.2,
      humidity: overrides?.humidity ?? 72,
      weatherCode: 0,
      condition: 'clear',
      windSpeed: overrides?.windSpeed ?? 9.3,
      windDirection: overrides?.windDirection ?? 220,
      precipitation: 0,
    },
    hourly: [],
    daily: [day('2026-05-03'), day('2026-05-04')],
  };
}

describe('CurrentSlide — loading skeleton', () => {
  it('renders the loading skeleton when forecast is null', () => {
    render(<CurrentSlide forecast={null} timeFormat="24h" units="metric" />);
    expect(
      screen.queryByTestId('slide-current-content'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('slide-current-shell')).toBeInTheDocument();
  });

  it('keeps the "Current" title visible during the loading skeleton', () => {
    render(<CurrentSlide forecast={null} timeFormat="24h" units="metric" />);
    expect(screen.getByTestId('slide-title')).toHaveTextContent('Current');
  });
});

describe('CurrentSlide — title', () => {
  it('renders a "Current" title at the top of the slide once data is loaded', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
      />,
    );
    expect(screen.getByTestId('slide-title')).toHaveTextContent('Current');
  });
});

describe('CurrentSlide — wind tile', () => {
  it('renders the wind direction degrees on the SVG arrow', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ windDirection: 270 })}
        timeFormat="24h"
        units="metric"
      />,
    );
    const arrow = screen.getByTestId('wind-arrow');
    expect(arrow.getAttribute('data-direction-degrees')).toBe('270');
  });

  it('rotates the wind arrow by direction + 180° (Open-Meteo convention is "from")', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ windDirection: 90 })}
        timeFormat="24h"
        units="metric"
      />,
    );
    const arrow = screen.getByTestId('wind-arrow');
    // 90° wind from the east → arrow points east-bound = 270° rendered.
    expect(arrow.style.transform).toBe('rotate(270deg)');
  });

  it('shows wind speed in km/h when units are metric', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ windSpeed: 18.4 })}
        timeFormat="24h"
        units="metric"
      />,
    );
    const tile = screen.getByTestId('tile-wind');
    expect(tile.textContent).toContain('18');
    expect(tile.textContent).toContain('km/h');
  });

  it('converts wind speed to mph when units are imperial', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ windSpeed: 16.0 })}
        timeFormat="24h"
        units="imperial"
      />,
    );
    const tile = screen.getByTestId('tile-wind');
    // 16 km/h * 0.621371 ≈ 9.94, rounds to 10.
    expect(tile.textContent).toContain('10');
    expect(tile.textContent).toContain('mph');
  });
});

describe('CurrentSlide — humidity tile', () => {
  it('renders humidity as a rounded percentage', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ humidity: 73.6 })}
        timeFormat="24h"
        units="metric"
      />,
    );
    const tile = screen.getByTestId('tile-humidity');
    expect(tile.textContent).toContain('74%');
  });
});

describe('CurrentSlide — sunrise / sunset tile', () => {
  it('renders sunrise + sunset times stacked vertically', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
      />,
    );
    const sunrise = screen.getByTestId('tile-sunrise');
    const sunset = screen.getByTestId('tile-sunset');
    expect(sunrise).toBeInTheDocument();
    expect(sunset).toBeInTheDocument();
    expect(sunrise.textContent).toContain('06:14');
    expect(sunset.textContent).toContain('20:42');
  });

  it('respects the 12 h time format setting', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="12h"
        units="metric"
      />,
    );
    expect(screen.getByTestId('tile-sunrise').textContent).toContain('6:14 AM');
    expect(screen.getByTestId('tile-sunset').textContent).toContain('8:42 PM');
  });

  it('renders the sun tile even when daily entry for today is missing', () => {
    const f = buildForecast();
    f.daily = [];
    render(<CurrentSlide forecast={f} timeFormat="24h" units="metric" />);
    expect(screen.getByTestId('tile-sun')).toBeInTheDocument();
    expect(screen.queryByTestId('tile-sunrise')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tile-sunset')).not.toBeInTheDocument();
  });
});

describe('CurrentSlide — fits inside the default window', () => {
  it('uses a tighter top title reserve than the scrolling slides so the 2 × 2 grid fits', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
      />,
    );
    const body = screen.getByTestId('slide-body');
    expect(Number(body.getAttribute('data-top-reserved-px'))).toBeLessThan(30);
  });

  it('uses a tighter bottom-nav reserve than the scrolling slides', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
      />,
    );
    const body = screen.getByTestId('slide-body');
    // Scrolling slides reserve 36 px; the fixed grid only needs to
    // clear the dot indicator + arrows.
    expect(Number(body.getAttribute('data-bottom-reserved-px'))).toBeLessThan(
      36,
    );
  });
});

describe('CurrentSlide — diagnostic subtitle', () => {
  it('shows the city name when location is provided', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
        location={{ latitude: 49.9, longitude: -119.5, city: 'Kelowna' }}
      />,
    );
    const subtitle = screen.getByTestId('slide-current-subtitle');
    expect(subtitle.textContent).toContain('Kelowna');
  });

  it('shows the last-updated time formatted to the user time format (24 h)', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
        location={{ latitude: 49.9, longitude: -119.5, city: 'Kelowna' }}
        lastUpdated="2026-05-08T11:23:00.000Z"
      />,
    );
    // The exact rendered HH:MM depends on the test runner's local zone,
    // but the format should match HH:MM (zero-padded) when timeFormat=24h.
    const subtitle = screen.getByTestId('slide-current-subtitle');
    expect(subtitle.textContent).toMatch(/Kelowna · \d{2}:\d{2}/);
  });

  it('uses 12 h AM/PM formatting when timeFormat=12h', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="12h"
        units="metric"
        location={{ latitude: 49.9, longitude: -119.5, city: 'Kelowna' }}
        lastUpdated="2026-05-08T11:23:00.000Z"
      />,
    );
    const subtitle = screen.getByTestId('slide-current-subtitle');
    expect(subtitle.textContent).toMatch(/Kelowna · \d{1,2}:\d{2} (AM|PM)/);
  });

  it('omits the subtitle entirely when neither location nor lastUpdated is known', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
      />,
    );
    expect(
      screen.queryByTestId('slide-current-subtitle'),
    ).not.toBeInTheDocument();
  });

  it('falls back to just the time when city is unknown', () => {
    render(
      <CurrentSlide
        forecast={buildForecast()}
        timeFormat="24h"
        units="metric"
        location={{ latitude: 49.9, longitude: -119.5, city: null }}
        lastUpdated="2026-05-08T11:23:00.000Z"
      />,
    );
    const subtitle = screen.getByTestId('slide-current-subtitle');
    expect(subtitle.textContent).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('CurrentSlide — feels-like tile', () => {
  it('renders feels-like value with °C suffix in metric', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ apparentTemperature: 12.7 })}
        timeFormat="24h"
        units="metric"
      />,
    );
    const tile = screen.getByTestId('tile-feels-like');
    expect(tile.textContent).toContain('13');
    expect(tile.textContent).toContain('°C');
  });

  it('converts feels-like to Fahrenheit when units are imperial', () => {
    render(
      <CurrentSlide
        forecast={buildForecast({ apparentTemperature: 0 })}
        timeFormat="24h"
        units="imperial"
      />,
    );
    const tile = screen.getByTestId('tile-feels-like');
    // 0°C → 32°F.
    expect(tile.textContent).toContain('32');
    expect(tile.textContent).toContain('°F');
  });
});
