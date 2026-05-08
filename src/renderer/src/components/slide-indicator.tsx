import type { CSSProperties } from 'react';

// Whether the slide background is lighter or darker than mid-grey, so
// the indicator can pick a contrasting dot color. Defined here (the
// consumer) and re-exported to slide-deck to avoid a circular import.
export type SlideBackgroundLuminance = 'dark' | 'light';

// Plan/slides.md: indicator dots sit between the prev / next arrows in
// the bottom navigation bar. One dot per currently-active slide; the
// active slide's dot is larger. Dot color is adaptive — light on dark
// slide backgrounds, dark on the (light-mode) Settings slide.
//
// Container is a non-positioned inline flex so SlideDeck's bottom bar
// can lay it out alongside the arrows. The bottom-pinning that used
// to live here was lifted into SlideDeck when arrow placement moved
// from the panel edges into the navigation bar.
const DOT_SIZE_INACTIVE_PX = 6;
const DOT_SIZE_ACTIVE_PX = 10;
const DOT_GAP_PX = 6;

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
  display: 'inline-flex',
  alignItems: 'center',
  gap: DOT_GAP_PX,
  // Dots are decorative — clicks pass through to the bottom-bar so a
  // misclick between dots doesn't swallow an arrow press.
  pointerEvents: 'none',
};
