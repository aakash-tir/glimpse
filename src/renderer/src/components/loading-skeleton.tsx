import type { CSSProperties } from 'react';

// Plan/slides.md: "muted-grey skeleton placeholders shaped like the
// real content (tiles, cards), with a subtle horizontal sweep shimmer
// repeating every ~1.5 s. Skeletons replace themselves with real
// content as data arrives."
//
// Two variants, one per M6 slide. Each composes the same SkeletonBlock
// primitive (a muted-grey rectangle with the sweep overlay) into the
// shape of that slide's visible area:
//
//   hourly   — a row of 6 tile-shaped blocks (matches the 6/page snap).
//   seven-day — 3 stacked row-shaped blocks (matches the 3/page snap).
//
// Animation is driven by the `glimpse-skeleton-sweep` @keyframes in
// index.css rather than Framer Motion: the sweep is a passive
// decoration, not a stateful animation, and the CSS path stays in the
// compositor without round-tripping through React on every frame.

export const SHIMMER_PERIOD_S = 1.5;

const SKELETON_BG = 'rgba(255, 255, 255, 0.08)';
const SKELETON_HIGHLIGHT =
  'linear-gradient(' +
  '90deg,' +
  ' rgba(255, 255, 255, 0) 0%,' +
  ' rgba(255, 255, 255, 0.18) 50%,' +
  ' rgba(255, 255, 255, 0) 100%' +
  ')';

type SkeletonBlockProps = {
  width: string | number;
  height: string | number;
  radius?: number;
  style?: CSSProperties;
  testId?: string;
};

function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
  testId = 'skeleton-block',
}: SkeletonBlockProps): JSX.Element {
  return (
    <div
      data-testid={testId}
      data-shimmer-active="on"
      data-shimmer-period-s={String(SHIMMER_PERIOD_S)}
      style={{
        position: 'relative',
        width,
        height,
        background: SKELETON_BG,
        borderRadius: radius,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: SKELETON_HIGHLIGHT,
          animation: `glimpse-skeleton-sweep ${SHIMMER_PERIOD_S}s linear infinite`,
          willChange: 'transform',
        }}
      />
    </div>
  );
}

export type LoadingSkeletonProps = {
  variant: 'hourly' | 'seven-day';
};

export function LoadingSkeleton({
  variant,
}: LoadingSkeletonProps): JSX.Element {
  return (
    <div
      data-testid={`loading-skeleton-${variant}`}
      data-variant={variant}
      data-shimmer-period-s={String(SHIMMER_PERIOD_S)}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: variant === 'hourly' ? 'row' : 'column',
        gap: 6,
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      {variant === 'hourly' ? (
        <HourlySkeletonContents />
      ) : (
        <SevenDaySkeletonContents />
      )}
    </div>
  );
}

function HourlySkeletonContents(): JSX.Element {
  // Six tile-shaped placeholders matching the 6/page hourly snap.
  // Each tile is a vertical stack: time line, icon block, temp line,
  // precip line — same vertical rhythm as the real cells, so the
  // transition into real content doesn't shift the layout.
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          data-testid="loading-skeleton-hour-cell"
          style={{
            flex: '1 1 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <SkeletonBlock width="60%" height={10} testId="skeleton-line" />
          <SkeletonBlock
            width={28}
            height={28}
            radius={14}
            testId="skeleton-icon"
          />
          <SkeletonBlock width="50%" height={12} testId="skeleton-line" />
          <SkeletonBlock width="40%" height={10} testId="skeleton-line" />
        </div>
      ))}
    </>
  );
}

function SevenDaySkeletonContents(): JSX.Element {
  // Three row-shaped placeholders matching the 3/page seven-day snap.
  // Each row is a horizontal stack: day label · icon · high/low · precip.
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          data-testid="loading-skeleton-day-row"
          style={{
            flex: '1 1 0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 4,
            paddingRight: 4,
          }}
        >
          <SkeletonBlock width={48} height={12} testId="skeleton-line" />
          <SkeletonBlock
            width={28}
            height={28}
            radius={14}
            testId="skeleton-icon"
          />
          <SkeletonBlock width={64} height={12} testId="skeleton-line" />
          <SkeletonBlock width={36} height={10} testId="skeleton-line" />
        </div>
      ))}
    </>
  );
}
