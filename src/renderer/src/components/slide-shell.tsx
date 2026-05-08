import type { ReactNode } from 'react';

// Plan/slides.md slides 1 + 2: a title sits at the top of the slide
// and stays visible during the loading skeleton. SlideShell handles
// the title + body-area layout so both TodaySlide and SevenDaySlide
// can drop their content (skeleton or scrollable track) into the body
// without duplicating the title-positioning math.
//
// Layout:
//   ┌──────────────────────────────────┐
//   │       TITLE (centered)           │  ← TITLE_TOP_PX + TITLE_LINE_PX
//   ├──────────────────────────────────┤
//   │                                  │
//   │   body (children render here)    │
//   │                                  │
//   └──────────────────────────────────┘
//
// The body is its own positioned ancestor, so absolutely-positioned
// children (LoadingSkeleton, ScrollableSlide) using `inset: 0` fill
// the body region — not the whole slide — automatically.

const TITLE_TOP_PX = 6;
const TITLE_LINE_PX = 18;
// Total area reserved for the title (top inset + line height + a few
// pixels of breathing room before the body).
export const SLIDE_TITLE_AREA_PX = TITLE_TOP_PX + TITLE_LINE_PX + 6;

export type SlideShellProps = {
  title: string;
  /** Test id on the outer wrapper for scoped queries. */
  testId?: string;
  /**
   * Pixels reserved at the bottom of the body — kept clear of slide
   * content so vertically-centered cells land in the visible middle
   * of the panel rather than centering against the bottom nav bar.
   */
  bottomReservedPx?: number;
  children: ReactNode;
};

export function SlideShell({
  title,
  testId,
  bottomReservedPx = 0,
  children,
}: SlideShellProps): JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        position: 'absolute',
        inset: 0,
      }}
    >
      <div
        data-testid="slide-title"
        data-slide-title={title}
        style={{
          position: 'absolute',
          top: TITLE_TOP_PX,
          left: 0,
          right: 0,
          height: TITLE_LINE_PX,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: 'rgba(255, 255, 255, 0.85)',
          // The title bar (when revealed by hover) overlays the slide
          // title via its own higher z-index, so a brief reveal is
          // expected behavior — no z-index needed here.
          pointerEvents: 'none',
          textTransform: 'none',
        }}
      >
        {title}
      </div>
      <div
        data-testid="slide-body"
        data-bottom-reserved-px={String(bottomReservedPx)}
        style={{
          position: 'absolute',
          top: SLIDE_TITLE_AREA_PX,
          left: 0,
          right: 0,
          bottom: bottomReservedPx,
        }}
      >
        {children}
      </div>
    </div>
  );
}
