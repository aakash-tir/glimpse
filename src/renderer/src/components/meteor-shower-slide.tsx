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
// reshuffle the points (only their brightness twinkles — see below).
// Each star slowly breathes between its base opacity and ~30 % of it
// over a 10 s cycle, starting at a random phase so the field shimmers
// instead of pulsing in unison. The shooting star fires ~once every 6 s;
// each fire picks a fresh random trajectory — a random point on one
// window edge to a random point on the opposite edge — so it streaks
// across the pane at a random angle and exits the far side. A timer
// bumps a counter every interval; the streak element is keyed on that
// counter so it remounts and replays with the new trajectory. Tests
// don't drive the animation — they assert the duration / cadence
// values via data attributes.

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { MeteorEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

const BG_COLOR = '#0a0a1f';
const STAR_COUNT = 36;
// Each star breathes between its base opacity and ~30 % of it over
// this period. Every star gets a random phase offset (see
// generateStars / twinkleKeyframes) so they start at different points
// in the cycle and the field shimmers instead of pulsing in unison.
export const STAR_TWINKLE_PERIOD_S = 10;
const STAR_TWINKLE_DIM = 0.3; // floor brightness as a fraction of base
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
      {/* Star field — fixed positions, slowly twinkling brightness.
          SVG so the points scale with the slide and stay sharp at any
          window size. */}
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
          <motion.path
            key={i}
            data-star=""
            data-cx={s.x}
            d={sparklePath(s.x, s.y, s.r)}
            fill="white"
            animate={{ opacity: twinkleKeyframes(s.opacity, s.phase) }}
            transition={{
              duration: STAR_TWINKLE_PERIOD_S,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
      {/* Shooting star: a streak that crosses the pane edge-to-edge at
          a random angle, re-randomized each fire. Sits behind the
          content layer (zIndex 0) so it never obscures the text. */}
      <ShootingStar />
    </>
  );
}

type Trajectory = {
  start: { x: number; y: number };
  end: { x: number; y: number };
};

// A random straight crossing: a random point on one window edge to a
// random point on the OPPOSITE edge (percentages of the slide). The
// differing positions along the two edges give a random angle.
function randomTrajectory(): Trajectory {
  const r = (): number => Math.random() * 100;
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      return { start: { x: 0, y: r() }, end: { x: 100, y: r() } }; // L→R
    case 1:
      return { start: { x: 100, y: r() }, end: { x: 0, y: r() } }; // R→L
    case 2:
      return { start: { x: r(), y: 0 }, end: { x: r(), y: 100 } }; // T→B
    default:
      return { start: { x: r(), y: 100 }, end: { x: r(), y: 0 } }; // B→T
  }
}

function ShootingStar(): JSX.Element {
  // Each interval picks a fresh trajectory and bumps the remount key so
  // the streak replays from the new start point.
  const [fire, setFire] = useState(() => ({ n: 0, traj: randomTrajectory() }));
  useEffect(() => {
    const id = setInterval(
      () => setFire((f) => ({ n: f.n + 1, traj: randomTrajectory() })),
      SHOOTING_STAR_INTERVAL_S * 1000,
    );
    return () => clearInterval(id);
  }, []);

  const { start, end } = fire.traj;
  // Angle of travel so the streak's bright head (gradient's right end)
  // leads in the direction of motion.
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <motion.div
      key={fire.n}
      data-testid="meteor-shooting-star"
      data-shooting-duration-s={String(SHOOTING_STAR_DURATION_S)}
      data-shooting-interval-s={String(SHOOTING_STAR_INTERVAL_S)}
      initial={{ left: `${start.x}%`, top: `${start.y}%`, opacity: 0 }}
      animate={{
        left: [`${start.x}%`, `${mid.x}%`, `${end.x}%`],
        top: [`${start.y}%`, `${mid.y}%`, `${end.y}%`],
        opacity: [0, 1, 0],
      }}
      transition={{ duration: SHOOTING_STAR_DURATION_S, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width: '15%',
        height: 1.5,
        // x/y centre the streak on (left, top); rotate aims it along
        // the travel direction. transform-origin defaults to centre.
        x: '-50%',
        y: '-50%',
        rotate: angle,
        background:
          'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.95) 100%)',
        borderRadius: 2,
        boxShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
      }}
    />
  );
}

type StarPoint = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  /** Random start position in the twinkle cycle, 0..1. */
  phase: number;
};

/**
 * Generate a deterministic field of star points for the background.
 * Seed is the shower name so cube transitions / re-renders preserve
 * the layout instead of reshuffling.
 */
// Minimum gap (in viewBox units) kept between two sparkles on top of
// the sum of their spike radii, so even the tips never touch.
const STAR_MIN_GAP = 0.8;
// Cap on resample attempts per star before we give up and place it
// anyway. The field is sparse enough that this is effectively never
// hit; the cap only guards against a pathological infinite loop.
const STAR_PLACE_ATTEMPTS = 60;

function generateStars(seed: string): StarPoint[] {
  const rand = mulberry32(hashSeed(seed));
  const out: StarPoint[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    // Size first — the overlap test needs the radius. Spike length
    // (outer radius) in 100×100 viewBox units; cubed random biases
    // toward small stars with a few prominent ones (real-sky look).
    // The window is square-locked (M3) so preserveAspectRatio="none"
    // keeps the sparkles symmetric.
    const r = 0.6 + Math.pow(rand(), 2.5) * 0.7;
    const opacity = 0.45 + rand() * 0.5;
    let x = rand() * 100;
    let y = rand() * 100;
    for (
      let attempt = 1;
      attempt < STAR_PLACE_ATTEMPTS && overlapsAny(x, y, r, out);
      attempt++
    ) {
      x = rand() * 100;
      y = rand() * 100;
    }
    // Random point in the twinkle cycle so stars don't pulse together.
    const phase = rand();
    out.push({ x, y, r, opacity, phase });
  }
  return out;
}

// Phase-shifted twinkle keyframes for one star: a cosine sampled over
// a full cycle starting at `phase`, oscillating between `base` opacity
// and STAR_TWINKLE_DIM × base. Cosine is periodic so the first and
// last samples match → seamless `repeat: Infinity` loop, and the
// per-star phase makes each begin at a different brightness.
function twinkleKeyframes(base: number, phase: number): number[] {
  const STEPS = 12;
  const dim = base * STAR_TWINKLE_DIM;
  const mid = (base + dim) / 2;
  const amp = (base - dim) / 2;
  const kf: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    kf.push(mid + amp * Math.cos(2 * Math.PI * (phase + i / STEPS)));
  }
  return kf;
}

// True if a candidate star at (x, y) with spike radius r would touch
// any already-placed star (centre distance < r1 + r2 + gap).
function overlapsAny(
  x: number,
  y: number,
  r: number,
  placed: readonly StarPoint[],
): boolean {
  return placed.some((s) => {
    const minDist = r + s.r + STAR_MIN_GAP;
    const dx = x - s.x;
    const dy = y - s.y;
    return dx * dx + dy * dy < minDist * minDist;
  });
}

// 4-point sparkle ("twinkle") star path centred at (cx, cy). `tip` is
// the spike length (outer radius); the inner valley radius is a small
// fraction of it so the four spikes taper to sharp points — the look
// of the reference night-sky art rather than a plain dot.
function sparklePath(cx: number, cy: number, tip: number): string {
  const inner = tip * 0.28;
  const d = inner * Math.SQRT1_2;
  const r = (n: number): number => Math.round(n * 1000) / 1000;
  const p = (x: number, y: number): string => `${r(x)} ${r(y)}`;
  return (
    `M ${p(cx, cy - tip)} ` +
    `L ${p(cx + d, cy - d)} ` +
    `L ${p(cx + tip, cy)} ` +
    `L ${p(cx + d, cy + d)} ` +
    `L ${p(cx, cy + tip)} ` +
    `L ${p(cx - d, cy + d)} ` +
    `L ${p(cx - tip, cy)} ` +
    `L ${p(cx - d, cy - d)} Z`
  );
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
