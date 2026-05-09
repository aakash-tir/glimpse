// Blood moon event slide. Plan/slides.md § Special events — blood moon.
//
//   Body fields: peak time in user's local time · visibility text.
//   Background:  linear gradient #2a0a05 → #5a1a0a — warmer / oranger
//                than the eclipse slide so the two read differently
//                when both appear together.
//   Motion:      slow pulse with subtle colour shift toward orange,
//                5 s period.
//
// Blood moon slides only appear alongside total lunar eclipses (see
// computeActiveEvents) — every blood moon shares its date with an
// eclipse slide, so the user sees both stacked back-to-back. The
// per-slide gradient + warmer pulse make the totality reading distinct
// from the surrounding eclipse silhouette.

import { motion } from 'framer-motion';
import type { TimeFormat } from '../../../shared/settings-store';
import type { BloodMoonEvent } from '../../../shared/special-events';
import { formatLocalClock } from '../../../shared/time-format';
import { EventSlideShell } from './event-slide-shell';

const BG_COOL = 'linear-gradient(180deg, #2a0a05 0%, #5a1a0a 100%)';
// "Subtle colour shift toward orange" — same gradient endpoints
// nudged toward warmer hues at the pulse peak.
const BG_WARM = 'linear-gradient(180deg, #3d150a 0%, #7a2810 100%)';
export const BLOOD_MOON_PULSE_DURATION_S = 5;

export type BloodMoonSlideProps = {
  event: BloodMoonEvent;
  timeFormat: TimeFormat;
};

export function BloodMoonSlide({
  event,
  timeFormat,
}: BloodMoonSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  const { eclipse } = event;
  const peak = eclipse.peakTimeUtc
    ? formatLocalClock(eclipse.peakTimeUtc, timeFormat)
    : null;

  return (
    <EventSlideShell
      title="Blood moon"
      isTomorrow={isTomorrow}
      testIdToken="blood-moon"
      motionOverlay={<BloodMoonBackground />}
    >
      <div
        data-testid="blood-moon-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: '100%',
          textAlign: 'center',
        }}
      >
        {peak ? (
          <div
            data-testid="blood-moon-peak-time"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Peak {peak}
          </div>
        ) : null}
        {eclipse.visibility ? (
          <div
            data-testid="blood-moon-visibility"
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
      </div>
    </EventSlideShell>
  );
}

function BloodMoonBackground(): JSX.Element {
  return (
    <motion.div
      data-testid="blood-moon-bg-pulse"
      data-pulse-duration-s={String(BLOOD_MOON_PULSE_DURATION_S)}
      animate={{ background: [BG_COOL, BG_WARM, BG_COOL] }}
      transition={{
        duration: BLOOD_MOON_PULSE_DURATION_S,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: BG_COOL,
      }}
    />
  );
}
