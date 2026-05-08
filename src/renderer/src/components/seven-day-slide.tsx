import type { Forecast } from '../../../shared/forecast';
import { conditionToGlyph } from '../../../shared/condition';
import { formatDayLabel, localDate } from '../../../shared/forecast-window';
import { IconGlyph } from './icon-glyph';
import { LoadingSkeleton } from './loading-skeleton';
import { SlideShell } from './slide-shell';
import { ScrollableSlide, useResponsiveVisibleCount } from './today-slide';

// Plan/slides.md (slide 2 — Next 7 days):
//   - Today + next 6 days (7 rows total)
//   - Each row: day label · condition icon · high / low · precipitation %
//   - "Today" in row 1, weekday abbreviations after
//   - 3 days visible at a time, snap-to-page horizontal scroll
//   - Same 24 px edge-fade pattern as the hourly slide

const FORECAST_DAYS = 7;
// Plan/slides.md: visible-cell count is responsive — chosen so each
// daily cell stays roughly TARGET_CELL_WIDTH_PX wide, clamped to
// MIN..MAX. Default 240 px window resolves to 3; ≥ 560 px shows all 7.
const DAYS_TARGET_CELL_WIDTH_PX = 80;
const DAYS_MIN_VISIBLE = 2;
const DAYS_MAX_VISIBLE = FORECAST_DAYS;
// Pixels reserved at the bottom of the body for the slide-deck nav
// bar so cells centered in the body land in the middle of the visible
// (non-nav-bar) panel area.
const BOTTOM_NAV_RESERVE_PX = 36;

export type SevenDaySlideProps = {
  forecast: Forecast | null;
};

export function SevenDaySlide({ forecast }: SevenDaySlideProps): JSX.Element {
  const visiblePerPage = useResponsiveVisibleCount({
    sidePaddingPx: 0,
    targetCellWidthPx: DAYS_TARGET_CELL_WIDTH_PX,
    min: DAYS_MIN_VISIBLE,
    max: DAYS_MAX_VISIBLE,
  });

  if (!forecast) {
    return (
      <SlideShell
        title="Next 7 days"
        testId="slide-seven-day-shell"
        bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
      >
        <LoadingSkeleton variant="seven-day" />
      </SlideShell>
    );
  }

  const days = forecast.daily.slice(0, FORECAST_DAYS);
  const todayDate = localDate(forecast.current.time);

  // Each day-cell is its own snap target with width = 1/N of the
  // visible viewport, so a wheel scroll advances one day at a time
  // (plan/slides.md: snap-to-cell, not snap-to-page).
  const cellFlexBasis = `calc(100% / ${visiblePerPage})`;

  return (
    <SlideShell
      title="Next 7 days"
      testId="slide-seven-day-shell"
      bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
    >
      <ScrollableSlide
        testId="slide-seven-day-content"
        itemCount={days.length}
        visiblePerPage={visiblePerPage}
      >
        {days.map((day) => {
          // Daily summary uses the daytime icon variant — the row
          // represents the whole day, not a specific moment, so the day
          // glyph is always the right read.
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
                flex: `0 0 ${cellFlexBasis}`,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // Vertically center — see today-slide for rationale.
                // Body excludes the bottom-nav-bar reserve so the
                // visual midpoint of the data lands in the visible
                // middle of the panel.
                justifyContent: 'center',
                gap: 4,
                padding: '6px 4px',
                color: 'rgba(255, 255, 255, 0.92)',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                minWidth: 0,
                boxSizing: 'border-box',
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
      </ScrollableSlide>
    </SlideShell>
  );
}
