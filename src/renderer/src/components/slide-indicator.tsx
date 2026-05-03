import type { CSSProperties } from 'react';

// Whether the slide background is lighter or darker than mid-grey, so
// the indicator can pick a contrasting dot color. Defined here (the
// consumer) and re-exported to slide-deck to avoid a circular import.
export type SlideBackgroundLuminance = 'dark' | 'light';

// Plan/slides.md: "Centered along the bottom edge of the window: a row
// of small dots, one per currently-active slide. The active slide's dot
// is larger. Dot color is adaptive — light dots on dark slide
// backgrounds, dark dots on the (light-mode) Settings slide."
const DOT_SIZE_INACTIVE_PX = 6;
const DOT_SIZE_ACTIVE_PX = 10;
const DOT_GAP_PX = 6;
const BOTTOM_INSET_PX = 8;

const DOT_COLOR_ON_DARK = 'rgba(255, 255, 255, 0.9)';
const DOT_COLOR_ON_LIGHT = 'rgba(15, 23, 42, 0.85)';
const DOT_INACTIVE_OPACITY = 0.45;

export type SlideIndicatorProps = {
  currentIndex: number;
  slideCount: number;
  backgroundLuminance: SlideBackgroundLuminance;
};

export function SlideIndicator({
  currentIndex,
  slideCount,
  backgroundLuminance,
}: SlideIndicatorProps): JSX.Element {
  const dotColor =
    backgroundLuminance === 'light' ? DOT_COLOR_ON_LIGHT : DOT_COLOR_ON_DARK;

  return (
    <div
      data-testid="slide-indicator"
      data-slide-count={String(slideCount)}
      data-current-index={String(currentIndex)}
      data-background-luminance={backgroundLuminance}
      style={containerStyle}
    >
      {Array.from({ length: slideCount }, (_, i) => {
        const active = i === currentIndex;
        const size = active ? DOT_SIZE_ACTIVE_PX : DOT_SIZE_INACTIVE_PX;
        return (
          <span
            key={i}
            data-testid={`slide-dot-${i}`}
            data-active={active ? 'on' : 'off'}
            data-size-px={String(size)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: dotColor,
              opacity: active ? 1 : DOT_INACTIVE_OPACITY,
              transition:
                'width 150ms ease, height 150ms ease, opacity 150ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

const containerStyle: CSSProperties = {
  position: 'absolute',
  bottom: BOTTOM_INSET_PX,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: DOT_GAP_PX,
  zIndex: 4,
  pointerEvents: 'none',
};
