import type { CSSProperties } from 'react';

// Plan/slides.md (hourly + 7-day): "~14 px white edge-fade glow on the
// scrollable side. Alpha follows a quadratic curve so the highlight is
// concentrated near the panel edge rather than spread evenly across
// the gradient."
//
// Rendered by hourly + 7-day slides in M6. Defined here in M4 so the
// slide framework ships the affordance utility alongside the deck.
export const EDGE_FADE_WIDTH_PX = 14;

export type EdgeFadeProps = {
  side: 'left' | 'right';
  // Visibility — driven by scroll position in M6. Hidden = no gradient.
  visible: boolean;
  // The base color the gradient fades to at the panel edge. The
  // gradient's curve goes 0 → targetAlpha; pass an rgba color whose
  // alpha is the desired peak (e.g. `rgba(255,255,255,0.4)`).
  fadeToColor?: string;
};

const DEFAULT_FADE_COLOR = 'rgba(15, 23, 42, 0.92)';

// Quadratic ease-in stops: alpha(t) = targetAlpha * t^2. Concentrates
// most of the visual weight near the edge so the inner side blends
// almost invisibly into the cells while the outer side reads as a
// clear highlight. Stops at 0/25/50/75/100 % give a smooth-enough
// curve for a 14 px gradient without going stop-crazy.
const CURVE_STOPS_PCT = [0, 25, 50, 75, 100];
const CURVE_ALPHA_FACTORS = CURVE_STOPS_PCT.map((p) => (p / 100) ** 2);

export function EdgeFade({
  side,
  visible,
  fadeToColor = DEFAULT_FADE_COLOR,
}: EdgeFadeProps): JSX.Element {
  // Transparent → fadeToColor in the direction the user is scrolling
  // toward, so off-edge content visually melts into the panel rim.
  const gradientDirection = side === 'right' ? 'to right' : 'to left';
  const background = buildCurvedGradient(gradientDirection, fadeToColor);

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
      data-curve="quadratic"
      style={style}
    />
  );
}

// Build a multi-stop linear gradient whose alpha follows a quadratic
// curve from 0 → the target alpha embedded in `fadeToColor`. Falls
// back to a plain two-stop transparent → fadeToColor gradient if the
// color isn't parseable rgba, so the component keeps working with
// odd inputs even though the curve disappears.
function buildCurvedGradient(direction: string, fadeToColor: string): string {
  const parsed = parseRgba(fadeToColor);
  if (!parsed) {
    return `linear-gradient(${direction}, transparent, ${fadeToColor})`;
  }
  const { r, g, b, a } = parsed;
  const stops = CURVE_STOPS_PCT.map((pct, i) => {
    const alpha = a * CURVE_ALPHA_FACTORS[i]!;
    return `rgba(${r}, ${g}, ${b}, ${roundAlpha(alpha)}) ${pct}%`;
  });
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
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
