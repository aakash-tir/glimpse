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

function AuroraBackground(): JSX.Element {
  return (
    <>
      {/* Base gradient: stays at full opacity. */}
      <div
        data-testid="aurora-bg-gradient"
        style={{
          position: 'absolute',
          inset: 0,
          background: BG_GRADIENT,
        }}
      />
      {/* Shimmer overlay: a translucent diagonal sheen that oscillates
          its opacity between 0.85 and 1.0. The shimmer color leans
          toward the violet end so it reads as a soft aurora ribbon
          drifting across the gradient. */}
      <motion.div
        data-testid="aurora-shimmer"
        data-shimmer-duration-s={String(AURORA_SHIMMER_DURATION_S)}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{
          duration: AURORA_SHIMMER_DURATION_S,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 60% at 50% 30%, rgba(120, 220, 180, 0.18) 0%, rgba(120, 220, 180, 0) 70%)',
          mixBlendMode: 'screen',
        }}
      />
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
