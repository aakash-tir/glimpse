import type { CSSProperties } from 'react';
import type { MoonPhase, MoonPhaseName } from '../../../shared/astro';
import { LoadingSkeleton } from './loading-skeleton';
import { SlideShell } from './slide-shell';

// Plan/slides.md (slide 4 — Moon phase, conditional):
//   - Large stylized moon graphic with curved shadow showing current
//     phase.
//   - Below: phase name (e.g. "Waxing Gibbous") + illumination %.
//   - Background is wired by SlideDeck (#0a1628 deep navy).
// The graphic is a self-contained SVG so the component has no external
// asset dependency. The terminator arc is computed from the phase
// value via `moonPhasePath` below.

const BOTTOM_NAV_RESERVE_PX = 36;
const MOON_SVG_SIZE = 96;

const PHASE_LABELS: Record<MoonPhaseName, string> = {
  'new-moon': 'New Moon',
  'waxing-crescent': 'Waxing Crescent',
  'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous',
  'full-moon': 'Full Moon',
  'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter',
  'waning-crescent': 'Waning Crescent',
};

export type MoonSlideProps = {
  /** Null until SunCalc computes the current phase. */
  phase: MoonPhase | null;
};

export function MoonSlide({ phase }: MoonSlideProps): JSX.Element {
  if (!phase) {
    return (
      <SlideShell
        title="Moon"
        testId="slide-moon-shell"
        bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
      >
        <LoadingSkeleton variant="seven-day" />
      </SlideShell>
    );
  }

  const litPath = moonPhasePath(phase.phase);
  const illuminationPercent = Math.round(phase.illumination * 100);

  return (
    <SlideShell
      title="Moon"
      testId="slide-moon-shell"
      bottomReservedPx={BOTTOM_NAV_RESERVE_PX}
    >
      <div
        data-testid="slide-moon-content"
        data-phase-name={phase.name}
        data-phase-value={String(phase.phase)}
        data-illumination={String(phase.illumination)}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'rgba(255, 255, 255, 0.92)',
          fontFamily: 'system-ui, sans-serif',
          padding: '8px 12px',
          boxSizing: 'border-box',
        }}
      >
        <svg
          data-testid="moon-svg"
          width={MOON_SVG_SIZE}
          height={MOON_SVG_SIZE}
          viewBox="-52 -52 104 104"
          aria-hidden="true"
          style={moonSvgStyle}
        >
          {/* Unlit disc — visible by itself at new moon, peeks behind
              the lit shape during crescent / gibbous phases. */}
          <circle r={50} fill="#1f2742" />
          {/* Lit region computed from the phase value. Path may
              enclose zero area at exactly new moon, in which case
              only the unlit disc shows. */}
          {litPath ? (
            <path
              data-testid="moon-lit-path"
              d={litPath}
              fill="#f0e6c8"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth={0.5}
            />
          ) : null}
        </svg>
        <span
          data-testid="moon-phase-label"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}
        >
          {PHASE_LABELS[phase.name]}
        </span>
        <span
          data-testid="moon-illumination"
          style={{ fontSize: 11, opacity: 0.75 }}
        >
          {illuminationPercent}% illuminated
        </span>
      </div>
    </SlideShell>
  );
}

const moonSvgStyle: CSSProperties = {
  filter: 'drop-shadow(0 0 6px rgba(240, 230, 200, 0.18))',
};

/**
 * SVG `d` attribute tracing the lit (illuminated) region of the moon.
 * The disc has radius 50 centered at the origin. Returns null at exact
 * new moon (no lit area to draw — the unlit disc covers the whole
 * graphic).
 *
 * SunCalc's phase value semantics:
 *   0    = new moon
 *   0.25 = first quarter (right half lit, waxing)
 *   0.5  = full moon
 *   0.75 = last quarter (left half lit, waning)
 *
 * The lit region is bounded by an outer semicircle on whichever side
 * is illuminated and a "terminator" arc whose horizontal radius is
 * `50 * |cos(phase * 2π)|`. The terminator bulges toward the lit edge
 * during crescent phases and away from it during gibbous phases.
 *
 * Exported for direct unit testing of the path math.
 */
export function moonPhasePath(phaseValue: number): string | null {
  const p = ((phaseValue % 1) + 1) % 1;
  // Snap exact new-moon to no path so the dark disc shows alone. The
  // generated path would otherwise enclose zero area but still render
  // a sliver if there's any rasterization rounding.
  if (p < 0.0005 || p > 0.9995) return null;

  const angle = p * 2 * Math.PI;
  const rx = 50 * Math.abs(Math.cos(angle));

  // Outer semicircle: right side for waxing (p < 0.5), left for waning.
  const outerSweep = p < 0.5 ? 1 : 0;
  // Terminator bulge direction: toward illuminated edge during
  // crescent (p in (0, 0.25) or (0.75, 1)), away from it during
  // gibbous (p in (0.25, 0.75)).
  const isCrescent = p < 0.25 || p > 0.75;
  const termSweep = isCrescent ? 1 : 0;

  return [
    'M 0 -50',
    `A 50 50 0 0 ${outerSweep} 0 50`,
    `A ${rx.toFixed(4)} 50 0 0 ${termSweep} 0 -50`,
    'Z',
  ].join(' ');
}
