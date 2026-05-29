// Aurora event slide. Plan/slides.md § Special events — aurora.
//
//   Body fields: Kp value · user-aware visibility text · last-updated
//                time of the NOAA fetch.
//   Background:  linear gradient #0a2e1f → #2a0a3e (deep teal-green
//                → deep violet).
//   Motion:      slow shimmer drift, ~30 s loop, opacity 0.85 → 1.0.
//
// The shimmer is a soft horizontal sheen layered above the gradient at
// reduced opacity. It oscillates back and forth driven by Framer
// Motion's repeating animate prop with `repeatType: 'mirror'` for the
// 0.85 → 1.0 → 0.85 envelope. We animate via the `animate` prop on a
// motion.div so jsdom (used in component tests) just records the
// intended values without trying to drive a real animation loop.

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AuroraEvent } from '../../../shared/special-events';
import type { TimeFormat } from '../../../shared/settings-store';
import { formatLocalClock } from '../../../shared/time-format';
import { EventSlideShell } from './event-slide-shell';

const BG_GRADIENT = 'linear-gradient(135deg, #0a2e1f 0%, #2a0a3e 100%)';
export const AURORA_SHIMMER_DURATION_S = 30;

export type AuroraSlideProps = {
  event: AuroraEvent;
  timeFormat: TimeFormat;
  lastUpdated: string | null;
};

export function AuroraSlide({
  event,
  timeFormat,
  lastUpdated,
}: AuroraSlideProps): JSX.Element {
  const lastUpdatedText = lastUpdated
    ? formatLocalClock(lastUpdated, timeFormat)
    : null;
  // Round Kp to 1 decimal — matches NOAA's published precision and
  // keeps the slide compact.
  const kpDisplay = formatKp(event.kp);

  return (
    <EventSlideShell
      title="Aurora"
      isTomorrow={false}
      testIdToken="aurora"
      motionOverlay={<AuroraBackground />}
    >
      <div
        data-testid="aurora-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: '100%',
          textAlign: 'center',
        }}
      >
        <div
          data-testid="aurora-kp"
          data-kp={String(event.kp)}
          style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}
        >
          {kpDisplay}
        </div>
        <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1.4 }}>
          KP INDEX
        </div>
        <div
          data-testid="aurora-visibility"
          style={{
            fontSize: 12,
            opacity: 0.92,
            marginTop: 4,
            maxWidth: '90%',
          }}
        >
          {event.visibilityText}
        </div>
        {lastUpdatedText ? (
          <div
            data-testid="aurora-last-updated"
            style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}
          >
            Updated {lastUpdatedText}
          </div>
        ) : null}
      </div>
    </EventSlideShell>
  );
}

// Builds a randomized wandering keyframe path for a drifting ribbon.
// x/y meander through `waypoints` pseudo-random offsets so the sheen
// crosses the window unpredictably rather than on a fixed line. The
// last keyframe is forced equal to the first so `repeat: Infinity`
// loops seamlessly with no snap. Generated once per mount (useMemo) so
// each time the aurora slide appears the path is different, but stable
// across re-renders.
function useDriftPath(
  waypoints: number,
  xAmp: number,
  yAmp: number,
): {
  x: string[];
  y: string[];
  opacity: number[];
} {
  return useMemo(() => {
    const rand = (min: number, max: number): number =>
      Math.random() * (max - min) + min;
    const x: string[] = [];
    const y: string[] = [];
    const opacity: number[] = [];
    for (let i = 0; i < waypoints; i++) {
      x.push(`${rand(-xAmp, xAmp).toFixed(1)}%`);
      y.push(`${rand(-yAmp, yAmp).toFixed(1)}%`);
      opacity.push(Number(rand(0.55, 1).toFixed(2)));
    }
    x.push(x[0]!);
    y.push(y[0]!);
    opacity.push(opacity[0]!);
    return { x, y, opacity };
  }, [waypoints, xAmp, yAmp]);
}

function AuroraBackground(): JSX.Element {
  // Modest drift: hotspots wander but each radial is large enough that
  // its transparent falloff always lands OUTSIDE the window (see the
  // -70% insets below), so the wash covers every edge at all drift
  // extremes — no internal dark rim, no hard clip line.
  const teal = useDriftPath(6, 14, 10);
  const violet = useDriftPath(6, 14, 10);
  return (
    <>
      {/* Base gradient: stays at full opacity, full-bleed. */}
      <div
        data-testid="aurora-bg-gradient"
        style={{
          position: 'absolute',
          inset: 0,
          background: BG_GRADIENT,
        }}
      />
      {/* Shimmer layer — clipped to the window so the aurora is always
          bound by the pane. Each ribbon's radial is far larger than the
          window (inset -70%) and fades to transparent only well beyond
          the frame, so inside the pane the wash is everywhere non-zero
          and only its bright field shifts as the hotspots drift. */}
      <div
        data-testid="aurora-shimmer-clip"
        style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      >
        {/* Primary teal ribbon — hotspot biased to the upper-left. */}
        <motion.div
          data-testid="aurora-shimmer"
          data-shimmer-duration-s={String(AURORA_SHIMMER_DURATION_S)}
          animate={{ opacity: teal.opacity, x: teal.x, y: teal.y }}
          transition={{
            duration: AURORA_SHIMMER_DURATION_S,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            inset: '-70%',
            background:
              'radial-gradient(55% 55% at 45% 38%, rgba(120, 220, 180, 0.42) 0%, rgba(120, 220, 180, 0) 90%)',
            mixBlendMode: 'screen',
          }}
        />
        {/* Second, violet-leaning ribbon — hotspot biased to the
            lower-right and on its own independent random path, so the
            two cross unpredictably for a layered, living-curtain look
            while together blanketing the whole pane. */}
        <motion.div
          data-testid="aurora-shimmer-2"
          animate={{ opacity: violet.opacity, x: violet.x, y: violet.y }}
          transition={{
            duration: AURORA_SHIMMER_DURATION_S,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            inset: '-70%',
            background:
              'radial-gradient(55% 55% at 58% 60%, rgba(150, 120, 230, 0.34) 0%, rgba(150, 120, 230, 0) 90%)',
            mixBlendMode: 'screen',
          }}
        />
      </div>
    </>
  );
}

function formatKp(kp: number): string {
  // 1 decimal, but trim trailing ".0" so an integer Kp shows as "5"
  // not "5.0".
  const rounded = Math.round(kp * 10) / 10;
  const s = rounded.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
