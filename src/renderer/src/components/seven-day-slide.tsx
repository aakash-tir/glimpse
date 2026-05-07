import type { Forecast, ForecastDay } from '../../../shared/forecast';
import { conditionToGlyph } from '../../../shared/condition';
import { formatDayLabel, localDate } from '../../../shared/forecast-window';
import { IconGlyph } from './icon-glyph';
import { LoadingSkeleton } from './loading-skeleton';
import { ScrollableSlide } from './today-slide';

// Plan/slides.md (slide 2 — Next 7 days):
//   - Today + next 6 days (7 rows total)
//   - Each row: day label · condition icon · high / low · precipitation %
//   - "Today" in row 1, weekday abbreviations after
//   - 3 days visible at a time, snap-to-page horizontal scroll
//   - Same 24 px edge-fade pattern as the hourly slide

const DAYS_VISIBLE_PER_PAGE = 3;
const FORECAST_DAYS = 7;

export type SevenDaySlideProps = {
  forecast: Forecast | null;
};

export function SevenDaySlide({ forecast }: SevenDaySlideProps): JSX.Element {
  if (!forecast) {
    return <LoadingSkeleton variant="seven-day" />;
  }

  const days = forecast.daily.slice(0, FORECAST_DAYS);
  const todayDate = localDate(forecast.current.time);

  // Group into pages of DAYS_VISIBLE_PER_PAGE, same scroll-snap pattern
  // as the hourly slide. 7 days → 3 pages: [3, 3, 1].
  const pages: ForecastDay[][] = [];
  for (let i = 0; i < days.length; i += DAYS_VISIBLE_PER_PAGE) {
    pages.push(days.slice(i, i + DAYS_VISIBLE_PER_PAGE));
  }

  return (
    <ScrollableSlide
      testId="slide-seven-day-content"
      pageCount={pages.length}
      visiblePerPage={DAYS_VISIBLE_PER_PAGE}
    >
      {pages.map((page, pi) => (
        <div
          key={pi}
          data-testid="seven-day-page"
          data-cells-per-page={String(DAYS_VISIBLE_PER_PAGE)}
          style={{
            flex: '0 0 100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            display: 'flex',
            height: '100%',
          }}
        >
          {page.map((day) => {
            // Daily summary uses the daytime icon variant — the row
            // represents the whole day, not a specific moment, so the
            // day glyph is always the right read.
            const glyph = conditionToGlyph(day.condition, true);
            const label = formatDayLabel(day.date, todayDate);
            return (
              <div
                key={day.date}
                data-testid="seven-day-cell"
                data-day-date={day.date}
                data-day-label={label}
                data-glyph={glyph}
                style={{
                  flex: '1 1 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 4px',
                  color: 'rgba(255, 255, 255, 0.92)',
                  fontFamily: 'system-ui, sans-serif',
                  textAlign: 'center',
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                  {label}
                </span>
                <IconGlyph name={glyph} size={32} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {Math.round(day.high)}° / {Math.round(day.low)}°
                </span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>
                  {Math.round(day.precipitationProbability)}%
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </ScrollableSlide>
  );
}
