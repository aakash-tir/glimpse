// Meteor shower event slide. Plan/slides.md § Special events — meteor
// shower.
//
//   Body fields: name (in title) · peak date · ZHR (zenithal hourly
//                rate) · best viewing time.
//   Background:  solid #0a0a1f (near-black indigo) + 30–40 small
//                static white star points scattered across the slide
//                (1–2 px, varied opacity).
//   Motion:      occasional shooting star, ~1 every 6 s, 0.6 s
//                trajectory, fades at end.
//
// The star field is generated once at mount with a deterministic seed
// derived from the shower name so re-renders / cube transitions don't
// reshuffle the points (which would read as twinkling, which the spec
// does not call for). The shooting star is a single absolutely-
// positioned line driven by Framer Motion's repeat loop with a delay
// gap that produces the ~1-every-6 s cadence. Tests don't drive the
// animation — they assert the duration / cadence values via data
// attributes.

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { MeteorEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

const BG_COLOR = '#0a0a1f';
const STAR_COUNT = 36;
export const SHOOTING_STAR_DURATION_S = 0.6;
export const SHOOTING_STAR_INTERVAL_S = 6;

export type MeteorShowerSlideProps = {
  event: MeteorEvent;
};

export function MeteorShowerSlide({
  event,
}: MeteorShowerSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  const stars = useMemo(
    () => generateStars(event.shower.name),
    [event.shower.name],
  );

  return (
    <EventSlideShell
      title={`${event.shower.name} meteor shower`}
      isTomorrow={isTomorrow}
      testIdToken="meteor-shower"
      motionOverlay={<MeteorBackground stars={stars} />}
    >
      <div
        data-testid="meteor-content"
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
        <div data-testid="meteor-peak-date" style={{ fontSize: 12 }}>
          Peak: {formatPeakDate(event.shower.peakDate)}
        </div>
        <div
          data-testid="meteor-zhr"
          data-zhr={String(event.shower.zhr)}
          style={{ fontSize: 12, opacity: 0.85 }}
        >
          ZHR ≈ {event.shower.zhr}
        </div>
        <div
          data-testid="meteor-viewing-time"
          style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}
        >
          {event.shower.bestViewingTime}
        </div>
      </div>
    </EventSlideShell>
  );
}

function MeteorBackground({
  stars,
}: {
  stars: readonly StarPoint[];
}): JSX.Element {
  return (
    <>
      {/* Solid base. */}
      <div
        data-testid="meteor-bg-solid"
        style={{
          position: 'absolute',
          inset: 0,
          background: BG_COLOR,
        }}
      />
      {/* Static star field. SVG so the points scale with the slide
          and stay sharp at any window size. */}
      <svg
        data-testid="meteor-star-field"
        data-star-count={String(stars.length)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
        aria-hidden="true"
      >
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="white"
            opacity={s.opacity}
          />
        ))}
      </svg>
      {/* Shooting star: a single thin line that streaks across the
          slide every ~6 s. Animated x/opacity via Framer Motion. */}
      <motion.div
        data-testid="meteor-shooting-star"
        data-shooting-duration-s={String(SHOOTING_STAR_DURATION_S)}
        data-shooting-interval-s={String(SHOOTING_STAR_INTERVAL_S)}
        animate={{
          x: ['-20%', '120%'],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: SHOOTING_STAR_DURATION_S,
          ease: 'easeOut',
          times: [0, 0.6, 1],
          repeat: Infinity,
          // Repeat-delay produces the gap between streaks. With a
          // 0.6 s active streak and a 5.4 s gap, a new streak starts
          // every ~6 s on average per the spec.
          repeatDelay: SHOOTING_STAR_INTERVAL_S - SHOOTING_STAR_DURATION_S,
        }}
        style={{
          position: 'absolute',
          // Mid-upper third of the slide so the streak doesn't cross
          // the centered content.
          top: '28%',
          left: 0,
          width: '12%',
          height: 1.5,
          background:
            'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.95) 100%)',
          borderRadius: 2,
          boxShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
        }}
      />
    </>
  );
}

type StarPoint = {
  x: number;
  y: number;
  r: number;
  opacity: number;
};

/**
 * Generate a deterministic field of star points for the background.
 * Seed is the shower name so cube transitions / re-renders preserve
 * the layout instead of reshuffling.
 */
function generateStars(seed: string): StarPoint[] {
  const rand = mulberry32(hashSeed(seed));
  const out: StarPoint[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    out.push({
      x: rand() * 100,
      y: rand() * 100,
      // 0.4 → 0.9 SVG units inside a 100×100 viewBox. With
      // preserveAspectRatio="none" the rendered radii scale with the
      // slide; on a default ~240 px window that's ~1–2 px on screen.
      r: 0.4 + rand() * 0.5,
      opacity: 0.4 + rand() * 0.5,
    });
  }
  return out;
}

// 32-bit hash of a string. Used purely as a seed for mulberry32 so the
// star field is stable per shower name. Not a cryptographic hash.
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % 1_000_000) / 1_000_000;
  };
}

function formatPeakDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[Number(m[2]) - 1] ?? '';
  const day = String(Number(m[3]));
  return `${month} ${day}`;
}
