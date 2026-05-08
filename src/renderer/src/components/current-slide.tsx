import type { CSSProperties } from 'react';
import { WiHumidity, WiSunrise, WiSunset, WiThermometer } from 'react-icons/wi';
import type { Forecast } from '../../../shared/forecast';
import type { TimeFormat, Units } from '../../../shared/settings-store';
import { formatHourTime, localDate } from '../../../shared/forecast-window';
import { LoadingSkeleton } from './loading-skeleton';
import { SlideShell } from './slide-shell';

// Plan/slides.md (slide 3 — Current conditions): four metric tiles
//   - Wind: SVG arrow rotated by direction degrees + speed.
//   - Humidity: percentage with a small drop icon.
//   - Sunrise / sunset: two times stacked vertically with mini icons.
//   - Feels-like temperature: numeric.
// Background is the default dark glass; nav-bar reserve mirrors the
// other "always dark" slides so vertically-centered content lands in
// the visible (non-nav-bar) middle of the panel.

const BOTTOM_NAV_RESERVE_PX = 36;

// Open-Meteo's defaults: temperatures in °C, wind speed in km/h. The
// Settings units toggle picks the display label; converting numbers is
// trivial for first cut and keeps the data-fetching layer untouched.
const KMH_TO_MPH = 0.621371;
const C_TO_F = (c: number): number => c * (9 / 5) + 32;

export type CurrentSlideProps = {
  forecast: Forecast | null;
  timeFormat: TimeFormat;
  units: Units;
};

export function CurrentSlide({
  forecast,
  timeFormat,
  units,
}: CurrentSlideProps): JSX.Element {
  if (!forecast) {
    return (
      <SlideShell
        title="Current"
        testId="slide-current-shell"
        bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
      >
        <LoadingSkeleton variant="seven-day" />
      </SlideShell>
    );
  }

  const { current } = forecast;
  // Sunrise / sunset come from the daily array. Match against the
  // current local-zone date prefix so the slide always reflects today's
  // pair, even if the daily array's first entry is yesterday's leftover.
  const todayDate = localDate(current.time);
  const today = forecast.daily.find((d) => d.date === todayDate);
  const sunrise = today?.sunrise ?? null;
  const sunset = today?.sunset ?? null;

  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const speedUnit = units === 'imperial' ? 'mph' : 'km/h';
  const feelsLike =
    units === 'imperial'
      ? C_TO_F(current.apparentTemperature)
      : current.apparentTemperature;
  const windSpeed =
    units === 'imperial' ? current.windSpeed * KMH_TO_MPH : current.windSpeed;

  return (
    <SlideShell
      title="Current"
      testId="slide-current-shell"
      bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
    >
      <div
        data-testid="slide-current-content"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 6,
          padding: '8px 10px',
          boxSizing: 'border-box',
        }}
      >
        <Tile testId="tile-wind" label="Wind">
          <WindArrow degrees={current.windDirection} />
          <span style={tileValueStyle}>
            {Math.round(windSpeed)}{' '}
            <span style={tileUnitStyle}>{speedUnit}</span>
          </span>
        </Tile>

        <Tile testId="tile-humidity" label="Humidity">
          <WiHumidity size={28} aria-hidden="true" />
          <span style={tileValueStyle}>{Math.round(current.humidity)}%</span>
        </Tile>

        <Tile testId="tile-sun" label="Sun">
          {sunrise ? (
            <span data-testid="tile-sunrise" style={sunRowStyle}>
              <WiSunrise size={22} aria-hidden="true" />
              <span>{formatHourTime(sunrise, timeFormat)}</span>
            </span>
          ) : null}
          {sunset ? (
            <span data-testid="tile-sunset" style={sunRowStyle}>
              <WiSunset size={22} aria-hidden="true" />
              <span>{formatHourTime(sunset, timeFormat)}</span>
            </span>
          ) : null}
        </Tile>

        <Tile testId="tile-feels-like" label="Feels like">
          <WiThermometer size={28} aria-hidden="true" />
          <span style={tileValueStyle}>
            {Math.round(feelsLike)}
            <span style={tileUnitStyle}>{tempUnit}</span>
          </span>
        </Tile>
      </div>
    </SlideShell>
  );
}

function Tile({
  testId,
  label,
  children,
}: {
  testId: string;
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid={testId}
      data-tile-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        color: 'rgba(255, 255, 255, 0.92)',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        minWidth: 0,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 4,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: 0.4,
          opacity: 0.65,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

const tileValueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.1,
};

const tileUnitStyle: CSSProperties = {
  fontSize: 9,
  opacity: 0.65,
  marginLeft: 2,
};

const sunRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  fontSize: 12,
  fontWeight: 500,
};

// Plan/slides.md: "Wind: SVG arrow rotated by direction degrees +
// speed value." Open-Meteo's wind direction is the angle the wind is
// blowing FROM (meteorological convention), so a 0° wind comes from
// the north — rendering the arrow rotated by `degrees` makes it point
// in the direction the wind is moving toward, which reads more
// naturally on the tile.
function WindArrow({ degrees }: { degrees: number }): JSX.Element {
  return (
    <svg
      data-testid="wind-arrow"
      data-direction-degrees={String(Math.round(degrees))}
      width={28}
      height={28}
      viewBox="0 0 24 24"
      style={{
        // Source SVG points up (north). Add 180° so 0° wind FROM north
        // = arrow points down (i.e. the wind is moving toward the
        // viewer's south).
        transform: `rotate(${degrees + 180}deg)`,
        transformOrigin: '50% 50%',
      }}
      aria-hidden="true"
    >
      <path
        d="M12 2 L17 12 L13 12 L13 22 L11 22 L11 12 L7 12 Z"
        fill="rgba(255, 255, 255, 0.92)"
        stroke="rgba(255, 255, 255, 0.92)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
