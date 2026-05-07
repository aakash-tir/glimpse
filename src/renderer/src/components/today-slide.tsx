import { useCallback, useEffect, useRef, useState } from 'react';
import type { Forecast, ForecastHour } from '../../../shared/forecast';
import type { TimeFormat } from '../../../shared/settings-store';
import { conditionToGlyph } from '../../../shared/condition';
import {
  formatHourTime,
  isHourDaytime,
  selectRollingHours,
} from '../../../shared/forecast-window';
import { EdgeFade } from './edge-fade';
import { IconGlyph } from './icon-glyph';
import { LoadingSkeleton } from './loading-skeleton';

// Plan/slides.md (slide 1 — Today / hourly):
//   - 24 rolling hours starting at the next full hour from now
//   - 6 hours visible at a time, snap-to-page horizontal scroll
//   - 24 px edge-fade gradient on right when more content; left
//     once scrolled past start
//   - Day vs night icon variants chosen against the user's local
//     sunrise / sunset
//   - Time format respects the 12 h / 24 h Settings toggle
//
// "Now" defaults to forecast.current.time so the component is
// deterministic against a fixture; tests / future-callers can override.

const HOURS_VISIBLE_PER_PAGE = 6;
const ROLLING_WINDOW_HOURS = 24;
// Tolerance for fractional pixel scrollLeft values reported by some
// browsers — without it, the right edge-fade flickers off at the very
// end of a scroll because (scrollLeft + clientWidth) is reported a
// fraction below scrollWidth.
const SCROLL_END_TOLERANCE_PX = 2;

export type TodaySlideProps = {
  forecast: Forecast | null;
  timeFormat: TimeFormat;
  /** Override "now" (local-zone string) for tests / future schedulers. */
  now?: string;
};

export function TodaySlide({
  forecast,
  timeFormat,
  now,
}: TodaySlideProps): JSX.Element {
  if (!forecast) {
    return <LoadingSkeleton variant="hourly" />;
  }

  const nowLocal = now ?? forecast.current.time;
  const hours = selectRollingHours(
    forecast.hourly,
    nowLocal,
    ROLLING_WINDOW_HOURS,
  );

  // Group the rolling hours into pages of HOURS_VISIBLE_PER_PAGE so
  // CSS scroll-snap-align: start on each page snaps exactly one
  // 6-hour chunk per scroll step (instead of snapping to the nearest
  // individual cell, which doesn't match the spec's "snap-to-page").
  const pages: ForecastHour[][] = [];
  for (let i = 0; i < hours.length; i += HOURS_VISIBLE_PER_PAGE) {
    pages.push(hours.slice(i, i + HOURS_VISIBLE_PER_PAGE));
  }

  return (
    <ScrollableSlide
      testId="slide-today-content"
      pageCount={pages.length}
      visiblePerPage={HOURS_VISIBLE_PER_PAGE}
    >
      {pages.map((page, pi) => (
        <div
          key={pi}
          data-testid="hourly-page"
          data-cells-per-page={String(HOURS_VISIBLE_PER_PAGE)}
          style={{
            flex: '0 0 100%',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            display: 'flex',
            height: '100%',
          }}
        >
          {page.map((hour) => {
            const isDay = isHourDaytime(hour.time, forecast.daily);
            const glyph = conditionToGlyph(hour.condition, isDay);
            return (
              <div
                key={hour.time}
                data-testid="hourly-cell"
                data-hour-time={hour.time}
                data-is-day={isDay ? 'on' : 'off'}
                data-glyph={glyph}
                style={{
                  flex: '1 1 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '4px 2px',
                  color: 'rgba(255, 255, 255, 0.92)',
                  fontFamily: 'system-ui, sans-serif',
                  textAlign: 'center',
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.75 }}>
                  {formatHourTime(hour.time, timeFormat)}
                </span>
                <IconGlyph name={glyph} size={26} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {Math.round(hour.temperature)}°
                </span>
                <span style={{ fontSize: 9, opacity: 0.7 }}>
                  {Math.round(hour.precipitationProbability)}%
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </ScrollableSlide>
  );
}

// Shared horizontal-scroll container used by the hourly slide (and, in
// the next commit, the 7-day slide). Wraps a row of pages with
// scroll-snap and tracks scroll position so the edge-fade gradient
// can show / hide at boundaries.
//
// Exported for the seven-day slide; intentionally kept private to this
// module via re-export from seven-day-slide.tsx to keep the surface
// area narrow.
type ScrollableSlideProps = {
  testId: string;
  pageCount: number;
  visiblePerPage: number;
  children: React.ReactNode;
};

export function ScrollableSlide({
  testId,
  pageCount,
  visiblePerPage,
  children,
}: ScrollableSlideProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const recompute = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    setCanScrollLeft(scrollLeft > SCROLL_END_TOLERANCE_PX);
    setCanScrollRight(
      scrollLeft + clientWidth < scrollWidth - SCROLL_END_TOLERANCE_PX,
    );
  }, []);

  useEffect(() => {
    recompute();
    if (typeof ResizeObserver === 'undefined') return;
    const node = trackRef.current;
    if (!node) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [recompute, pageCount]);

  return (
    <div
      data-testid={testId}
      data-page-count={String(pageCount)}
      data-visible-per-page={String(visiblePerPage)}
      style={{
        position: 'absolute',
        inset: 0,
        // Slide content sits above the cube face's debug border but
        // below the title-bar trigger zone and the slide arrows.
        zIndex: 1,
      }}
    >
      <div
        ref={trackRef}
        data-testid="scroll-track"
        onScroll={recompute}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          // Hide the scrollbar — the edge-fade is the only intended
          // affordance per plan/slides.md.
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>
      <EdgeFade side="left" visible={canScrollLeft} />
      <EdgeFade side="right" visible={canScrollRight} />
    </div>
  );
}
