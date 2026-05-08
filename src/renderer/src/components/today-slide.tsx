import { useCallback, useEffect, useRef, useState } from 'react';
import type { Forecast } from '../../../shared/forecast';
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
import { SlideShell } from './slide-shell';
import { useWindowInnerWidth } from './use-window-width';

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

const ROLLING_WINDOW_HOURS = 24;
// Horizontal breathing room around the hourly cells so they don't
// hug the panel edges. Plan/slides.md slide 1 calls for ~12 px each
// side. The 7-day slide currently uses 0 (its 1/3-viewport cells
// already have plenty of internal room).
const HOURLY_SIDE_PADDING_PX = 12;
// Plan/slides.md: visible cell count is responsive — chosen so each
// cell stays roughly TARGET_CELL_WIDTH_PX, clamped to MIN..MAX.
// Default 240 px window resolves to 5 visible cells; wider windows
// show more, narrower fewer.
const HOURLY_TARGET_CELL_WIDTH_PX = 48;
const HOURLY_MIN_VISIBLE = 3;
const HOURLY_MAX_VISIBLE = 8;
// Pixels reserved at the bottom of the body for the slide-deck nav
// bar (prev arrow · dots · next arrow). Cells are vertically centered
// in the body, so the reserve keeps the visual midpoint of the data
// inside the visible (non-nav-bar) region of the panel.
const BOTTOM_NAV_RESERVE_PX = 36;
// Tolerance for fractional pixel scrollLeft values reported by some
// browsers — without it, the right edge-fade flickers off at the very
// end of a scroll because (scrollLeft + clientWidth) is reported a
// fraction below scrollWidth.
const SCROLL_END_TOLERANCE_PX = 2;

// Plan/slides.md scroll affordance: the edge-fade fades to a
// semi-transparent white instead of the slide background, so the
// scrollable direction reads as a bright glow against the dark slide
// — more discoverable than the previous "fade-into-background" cue.
const EDGE_FADE_WHITE = 'rgba(255, 255, 255, 0.4)';

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
  const visiblePerPage = useResponsiveVisibleCount({
    sidePaddingPx: HOURLY_SIDE_PADDING_PX,
    targetCellWidthPx: HOURLY_TARGET_CELL_WIDTH_PX,
    min: HOURLY_MIN_VISIBLE,
    max: HOURLY_MAX_VISIBLE,
  });

  if (!forecast) {
    return (
      <SlideShell
        title="Today"
        testId="slide-today-shell"
        bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
      >
        <LoadingSkeleton variant="hourly" />
      </SlideShell>
    );
  }

  const nowLocal = now ?? forecast.current.time;
  const hours = selectRollingHours(
    forecast.hourly,
    nowLocal,
    ROLLING_WINDOW_HOURS,
  );

  // Each hour cell is its own snap target with width = 1/N of the
  // visible viewport, so a wheel scroll advances one column at a time
  // (plan/slides.md: snap-to-cell, not snap-to-page).
  const cellFlexBasis = `calc(100% / ${visiblePerPage})`;

  return (
    <SlideShell
      title="Today"
      testId="slide-today-shell"
      bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
    >
      <ScrollableSlide
        testId="slide-today-content"
        itemCount={hours.length}
        visiblePerPage={visiblePerPage}
        sidePaddingPx={HOURLY_SIDE_PADDING_PX}
      >
        {hours.map((hour) => {
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
                flex: `0 0 ${cellFlexBasis}`,
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // Vertically center the cell content. The body region
                // already excludes the bottom-nav-bar reserve, so the
                // visual midpoint of the data lands in the middle of
                // the visible (non-nav-bar) panel area.
                justifyContent: 'center',
                gap: 4,
                padding: '4px 2px',
                color: 'rgba(255, 255, 255, 0.92)',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
                minWidth: 0,
                boxSizing: 'border-box',
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
      </ScrollableSlide>
    </SlideShell>
  );
}

// Pick a responsive visible-cell count based on the current window
// width. Cells aim to render at roughly `targetCellWidthPx`; the count
// is clamped to [min, max] so very narrow windows still fit a few
// cells and very wide windows don't render an unreadable smear.
//
// Exported so SevenDaySlide can share the same hook with its own
// targets (different cell width, different bounds).
export function useResponsiveVisibleCount(opts: {
  sidePaddingPx: number;
  targetCellWidthPx: number;
  min: number;
  max: number;
}): number {
  const windowWidth = useWindowInnerWidth();
  const innerWidth = Math.max(0, windowWidth - opts.sidePaddingPx * 2);
  const raw = Math.round(innerWidth / opts.targetCellWidthPx);
  return Math.min(opts.max, Math.max(opts.min, raw));
}

// Shared horizontal-scroll container used by the hourly + 7-day slides.
// Children are individual cells (each with its own scroll-snap-align)
// so a scroll advances one cell at a time. Tracks scroll position so
// the edge-fade gradient can show / hide at boundaries.
//
// `sidePaddingPx` puts breathing room on the left + right of the scroll
// track. We can't use CSS `padding` on a positioned ancestor to push
// the absolutely-positioned track inward — `inset: 0` resolves against
// the padding box's *outer* edge per spec, so padding doesn't move
// absolute children. Instead we set explicit `left: sidePaddingPx;
// right: sidePaddingPx` on the track. clientWidth then naturally
// reflects the inner padded area, so `cellWidth = clientWidth /
// visiblePerPage` and `flex-basis: calc(100% / N)` both stay correct.
type ScrollableSlideProps = {
  testId: string;
  itemCount: number;
  visiblePerPage: number;
  /** Padding (px) applied on the left and right of the scroll track. */
  sidePaddingPx?: number;
  children: React.ReactNode;
};

export function ScrollableSlide({
  testId,
  itemCount,
  visiblePerPage,
  sidePaddingPx = 0,
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
  }, [recompute, itemCount]);

  // Translate vertical mouse-wheel input into horizontal scroll on the
  // track. Without this the slider is functionally invisible on desktop
  // — a regular wheel scroll does nothing because the track is
  // overflow-x only. Trackpad horizontal swipes still work natively
  // (they produce deltaX directly, which we leave alone).
  //
  // We advance exactly one cell width per wheel event, ignoring the
  // raw deltaY magnitude. Why: the hourly slide's cell is clientWidth /
  // 6 ≈ 40 px on a default-sized window, but a single wheel notch on
  // Windows produces ~100 px of deltaY. Scrolling by raw deltaY lands
  // 2–3 cells past the previous snap point and the mandatory CSS snap
  // settles there — the user reads that as the slider "skipping a
  // page" rather than nudging one column. Mapping each wheel event to
  // exactly one cell gives the same one-step feel on the hourly slide
  // (1/6 cells) as on the 7-day slide (1/3 cells).
  //
  // Bound via addEventListener with `passive: false` so we can call
  // preventDefault() on the wheel event; React's synthetic onWheel is
  // passive by default and would warn on preventDefault.
  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const handler = (e: WheelEvent): void => {
      // Only redirect predominantly-vertical wheel input. Trackpad
      // horizontal gestures already produce deltaX > deltaY and should
      // pass through to the native horizontal scroll.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      const cellWidth = node.clientWidth / visiblePerPage;
      node.scrollLeft += Math.sign(e.deltaY) * cellWidth;
    };
    node.addEventListener('wheel', handler, { passive: false });
    return () => node.removeEventListener('wheel', handler);
  }, [visiblePerPage]);

  return (
    <div
      data-testid={testId}
      data-item-count={String(itemCount)}
      data-visible-per-page={String(visiblePerPage)}
      data-side-padding-px={String(sidePaddingPx)}
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
          // Explicit left/right (instead of inset: 0) so the track is
          // pushed inward by sidePaddingPx, leaving breathing room at
          // the slide edges. top/bottom unchanged.
          top: 0,
          bottom: 0,
          left: sidePaddingPx,
          right: sidePaddingPx,
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          // Hide the native scrollbar — the white edge-fade is the
          // intended scrollability cue per plan/slides.md.
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {children}
      </div>
      <EdgeFade
        side="left"
        visible={canScrollLeft}
        fadeToColor={EDGE_FADE_WHITE}
      />
      <EdgeFade
        side="right"
        visible={canScrollRight}
        fadeToColor={EDGE_FADE_WHITE}
      />
    </div>
  );
}
