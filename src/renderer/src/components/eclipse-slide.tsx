// Eclipse event slide. Plan/slides.md § Special events — eclipse.
//
//   Body fields: type label (in title) · peak time in user's local
//                time · start / end times when the JSON entry has
//                them · visibility text · magnitude % when present.
//   Background:  radial gradient #1a0a0a (center) → #2a1010 (edges)
//                with a centred eclipse silhouette — a dark occulting
//                disc ringed by a glowing corona (the total-solar look).
//   Motion:      slow brightness pulse, 4 s period, ±5 % amplitude.
//
// This slide covers solar eclipses and partial/penumbral lunar
// eclipses. A TOTAL lunar eclipse is a blood moon, so it routes to the
// blood-moon slide instead (see computeActiveEvents) — this slide never
// renders for total-lunar in practice.

import { motion } from 'framer-motion';
import { eclipseTypeLabel } from '../../../shared/eclipses';
import type { TimeFormat } from '../../../shared/settings-store';
import type { EclipseEvent } from '../../../shared/special-events';
import { formatLocalClock } from '../../../shared/time-format';
import { EventSlideShell } from './event-slide-shell';

const BG_RADIAL = 'radial-gradient(circle at center, #1a0a0a 0%, #2a1010 100%)';
export const ECLIPSE_PULSE_DURATION_S = 4;
export const ECLIPSE_PULSE_AMPLITUDE = 0.05;

export type EclipseSlideProps = {
  event: EclipseEvent;
  timeFormat: TimeFormat;
};

export function EclipseSlide({
  event,
  timeFormat,
}: EclipseSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  const { eclipse } = event;
  const peak = eclipse.peakTimeUtc
    ? formatLocalClock(eclipse.peakTimeUtc, timeFormat)
    : null;
  const start = eclipse.startTimeUtc
    ? formatLocalClock(eclipse.startTimeUtc, timeFormat)
    : null;
  const end = eclipse.endTimeUtc
    ? formatLocalClock(eclipse.endTimeUtc, timeFormat)
    : null;
  const magnitudePct =
    eclipse.magnitude !== undefined
      ? Math.round(eclipse.magnitude * 100)
      : null;

  return (
    <EventSlideShell
      title={eclipseTypeLabel(eclipse.type)}
      isTomorrow={isTomorrow}
      testIdToken="eclipse"
      motionOverlay={<EclipseBackground />}
    >
      <div
        data-testid="eclipse-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: '100%',
          textAlign: 'center',
          // The corona is bright where wider lines cross it, so plain
          // white text loses contrast there. A dark halo keeps the
          // text legible over the corona while staying invisible
          // against the black disc — no single flat color does both.
          textShadow:
            '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8)',
        }}
      >
        {peak ? (
          <div
            data-testid="eclipse-peak-time"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Peak {peak}
          </div>
        ) : null}
        {start && end ? (
          <div
            data-testid="eclipse-start-end"
            style={{ fontSize: 11, opacity: 0.75 }}
          >
            {start} – {end}
          </div>
        ) : null}
        {eclipse.visibility ? (
          <div
            data-testid="eclipse-visibility"
            style={{
              fontSize: 11,
              opacity: 0.85,
              marginTop: 4,
              maxWidth: '92%',
            }}
          >
            {eclipse.visibility}
          </div>
        ) : null}
        {magnitudePct !== null ? (
          <div
            data-testid="eclipse-magnitude"
            data-magnitude={String(eclipse.magnitude)}
            style={{ fontSize: 11, opacity: 0.7 }}
          >
            Magnitude {magnitudePct}%
          </div>
        ) : null}
      </div>
    </EventSlideShell>
  );
}

function EclipseBackground(): JSX.Element {
  const pulse = {
    opacity: [1 - ECLIPSE_PULSE_AMPLITUDE, 1, 1 - ECLIPSE_PULSE_AMPLITUDE],
  };
  const pulseTransition = {
    duration: ECLIPSE_PULSE_DURATION_S,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  };
  return (
    <>
      <motion.div
        data-testid="eclipse-bg-pulse"
        data-pulse-duration-s={String(ECLIPSE_PULSE_DURATION_S)}
        data-pulse-amplitude={String(ECLIPSE_PULSE_AMPLITUDE)}
        animate={pulse}
        transition={pulseTransition}
        style={{
          position: 'absolute',
          inset: 0,
          background: BG_RADIAL,
        }}
      />
      {/* Eclipse silhouette: a dark occulting disc ringed by a glowing
          corona — the classic total-solar look. Centred behind the
          content; its corona breathes on the same pulse cadence. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          data-testid="eclipse-disc"
          animate={pulse}
          transition={pulseTransition}
          style={{
            width: '42%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: '#060304',
            boxShadow:
              '0 0 0 2px rgba(255, 240, 220, 0.85), 0 0 22px 6px rgba(255, 224, 180, 0.55), 0 0 70px 24px rgba(255, 180, 110, 0.28)',
          }}
        />
      </div>
    </>
  );
}
