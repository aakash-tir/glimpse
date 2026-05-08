import type { CSSProperties } from 'react';

// Plan/slides.md (hourly + 7-day): "~14 px white edge-fade glow on the
// scrollable side. Radial gradient anchored at the panel edge so
// iso-alpha lines arc inward from the edge — visually curved."
//
// Rendered by hourly + 7-day slides in M6. Defined here in M4 so the
// slide framework ships the affordance utility alongside the deck.
export const EDGE_FADE_WIDTH_PX = 14;

export type EdgeFadeProps = {
  side: 'left' | 'right';
  // Visibility — driven by scroll position in M6. Hidden = no gradient.
  visible: boolean;
  // The base color the gradient peaks at (at the panel edge). The
  // gradient runs 0 → targetAlpha; pass an rgba color whose alpha is
  // the desired peak (e.g. `rgba(255,255,255,0.4)`).
  fadeToColor?: string;
};

const DEFAULT_FADE_COLOR = 'rgba(15, 23, 42, 0.92)';

export function EdgeFade({
  side,
  visible,
  fadeToColor = DEFAULT_FADE_COLOR,
}: EdgeFadeProps): JSX.Element {
  const background = buildRadialGradient(side, fadeToColor);

  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EDGE_FADE_WIDTH_PX,
    [side]: 0,
    pointerEvents: 'none',
    background,
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
      data-curve="radial"
      style={style}
    />
  );
}

// Build a radial gradient anchored at the slide-edge midpoint. The
// ellipse is sized so its t=1 iso-alpha line traces the parenthesis
// curve from the user sketch (scroll-identi.png):
//   - horizontal radius = 100% of strip width → boundary touches the
//     inner edge of the strip at the vertical middle;
//   - vertical radius   =  50% of strip height → boundary touches
//     the panel edge at the top + bottom corners.
// That makes the visible alpha region a parenthesis-shaped sliver,
// brightest at the edge midpoint and fading to the background along
// the curved boundary.
//
// Falls back to a plain two-stop linear gradient if `fadeToColor`
// isn't parseable rgba — the component keeps working even though the
// curve disappears.
function buildRadialGradient(
  side: 'left' | 'right',
  fadeToColor: string,
): string {
  const parsed = parseRgba(fadeToColor);
  if (!parsed) {
    const dir = side === 'right' ? 'to right' : 'to left';
    return `linear-gradient(${dir}, transparent, ${fadeToColor})`;
  }
  const { r, g, b, a } = parsed;
  // Origin sits exactly at the slide edge, vertically centered.
  const origin = side === 'right' ? '100% 50%' : '0% 50%';
  const stops = [
    `rgba(${r}, ${g}, ${b}, ${roundAlpha(a)}) 0%`,
    `rgba(${r}, ${g}, ${b}, 0) 100%`,
  ].join(', ');
  return `radial-gradient(ellipse 100% 50% at ${origin}, ${stops})`;
}

function parseRgba(
  color: string,
): { r: string; g: string; b: string; a: number } | null {
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (!rgbMatch) return null;
  const parts = rgbMatch[1].split(',').map((s) => s.trim());
  if (parts.length < 3) return null;
  const a = parts.length >= 4 ? Number(parts[3]) : 1;
  if (!Number.isFinite(a)) return null;
  return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a };
}

function roundAlpha(value: number): number {
  return Math.round(value * 1000) / 1000;
}
