import type { CSSProperties } from 'react';

// Plan/slides.md (hourly + 7-day): "24 px gradient fade on the right
// edge whenever there's more content to scroll to (and on the left edge
// once the user has scrolled past the start). Fades disappear at the
// boundary."
//
// Rendered by hourly + 7-day slides in M6. Defined here in M4 so the
// slide framework ships the affordance utility alongside the deck.
export const EDGE_FADE_WIDTH_PX = 24;

export type EdgeFadeProps = {
  side: 'left' | 'right';
  // Visibility — driven by scroll position in M6. Hidden = no gradient.
  visible: boolean;
  // The base color the gradient fades to. Defaults match the dark-glass
  // slide background; M6 callers can override for the few slides whose
  // background is a different color.
  fadeToColor?: string;
};

const DEFAULT_FADE_COLOR = 'rgba(15, 23, 42, 0.92)';

export function EdgeFade({
  side,
  visible,
  fadeToColor = DEFAULT_FADE_COLOR,
}: EdgeFadeProps): JSX.Element {
  // Transparent → fadeToColor in the direction the user is scrolling
  // toward, so off-edge content visually melts into the panel rim.
  const gradientDirection = side === 'right' ? 'to right' : 'to left';
  const transparent = transparentize(fadeToColor);

  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EDGE_FADE_WIDTH_PX,
    [side]: 0,
    pointerEvents: 'none',
    background: `linear-gradient(${gradientDirection}, ${transparent}, ${fadeToColor})`,
    opacity: visible ? 1 : 0,
    transition: 'opacity 150ms ease-out',
    zIndex: 3,
  };

  return (
    <div
      data-testid={`edge-fade-${side}`}
      data-side={side}
      data-visible={visible ? 'on' : 'off'}
      data-width-px={String(EDGE_FADE_WIDTH_PX)}
      style={style}
    />
  );
}

// Returns a fully-transparent variant of an rgb / rgba color so the
// gradient starts at zero alpha. Falls back to `transparent` for unknown
// formats — the gradient still works, but the start-color hue may shift
// slightly during the fade.
function transparentize(color: string): string {
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) return 'transparent';
  const parts = rgbMatch[1].split(',').map((s) => s.trim());
  if (parts.length < 3) return 'transparent';
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 0)`;
}
