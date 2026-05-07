import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Forecast } from '../../../shared/forecast';
import type { TimeFormat } from '../../../shared/settings-store';
import {
  computeVisibleSlides,
  reconcileCurrentSlideIndex,
  wrapStep,
  type SlideId,
  type WrapDirection,
} from '../../../shared/slides';
import { SevenDaySlide } from './seven-day-slide';
import {
  SlideIndicator,
  type SlideBackgroundLuminance,
} from './slide-indicator';
import { TodaySlide } from './today-slide';

// Plan/styling.md: "Cube slide transition: 500 ms ease-in-out, rotates
// in the direction of the arrow click. No reverse-spin on wrap (loops
// continue in click direction)."
export const SLIDE_TRANSITION_DURATION_S = 0.5;

// Title bar trigger zone sits at the top, dot indicator hugs the
// bottom; slide content reserves space for both so placeholder text
// sits in the optical center of the *visible* slide area.
const SLIDE_TOP_PADDING_PX = 32;
const SLIDE_BOTTOM_PADDING_PX = 32;

// Plan/slides.md: "Left and right arrow buttons on the panel edges
// (only these two — no other navigation, no keyboard)."
const ARROW_INSET_PX = 6;
const ARROW_SIZE_PX = 28;

// Plan/styling.md: backgrounds per slide. Settings is the only
// theme-adaptive surface; all others stay dark. Theme-resolution wires
// up live in M7 — for M4, a `themeMode` prop selects between the two
// Settings palettes so the dot-color rule (light dots on dark slides,
// dark dots on light Settings) is reachable in tests today.
const BG_DARK_GLASS = 'rgba(15, 23, 42, 0.92)';
const BG_MOON = '#0a1628';
const BG_EVENTS_PLACEHOLDER = '#0a0a1f';
const BG_SETTINGS_DARK = '#0f172a';
const BG_SETTINGS_LIGHT = '#f8fafc';

export type ThemeMode = 'light' | 'dark';

export type { SlideBackgroundLuminance };

type SlideMeta = {
  id: SlideId;
  label: string;
  background: (themeMode: ThemeMode) => {
    color: string;
    luminance: SlideBackgroundLuminance;
  };
};

const SLIDE_META: Record<SlideId, SlideMeta> = {
  today: {
    id: 'today',
    label: 'Today',
    background: () => ({ color: BG_DARK_GLASS, luminance: 'dark' }),
  },
  'seven-day': {
    id: 'seven-day',
    label: 'Next 7 days',
    background: () => ({ color: BG_DARK_GLASS, luminance: 'dark' }),
  },
  current: {
    id: 'current',
    label: 'Current',
    background: () => ({ color: BG_DARK_GLASS, luminance: 'dark' }),
  },
  moon: {
    id: 'moon',
    label: 'Moon',
    background: () => ({ color: BG_MOON, luminance: 'dark' }),
  },
  events: {
    id: 'events',
    label: 'Events',
    background: () => ({
      color: BG_EVENTS_PLACEHOLDER,
      luminance: 'dark',
    }),
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    background: (themeMode) =>
      themeMode === 'light'
        ? { color: BG_SETTINGS_LIGHT, luminance: 'light' }
        : { color: BG_SETTINGS_DARK, luminance: 'dark' },
  },
};

export type SlideDeckProps = {
  // Visibility flags fed into the dynamic-count math. Defaults make the
  // deck render the M4 placeholder state (no moon, no events).
  moonEnabled?: boolean;
  eventsActive?: boolean;
  // Theme mode used for the Settings slide's background. Real theme
  // resolution lands in M7; tests pass this directly.
  themeMode?: ThemeMode;
  // Forecast snapshot driving the M6 hourly + 7-day slides. Null until
  // the first successful fetch — slide content components handle that
  // by swapping in their loading skeleton. Optional so M4 tests that
  // exercise the placeholder deck don't have to fabricate a forecast.
  forecast?: Forecast | null;
  // User's 12 h / 24 h preference. Forwarded to TodaySlide for the
  // hourly time labels.
  timeFormat?: TimeFormat;
};

type Transition = {
  fromSlideId: SlideId;
  direction: WrapDirection;
};

export function SlideDeck({
  moonEnabled = false,
  eventsActive = false,
  themeMode = 'dark',
  forecast = null,
  timeFormat = '24h',
}: SlideDeckProps): JSX.Element {
  const visibleSlides = useMemo(
    () => computeVisibleSlides({ moonEnabled, eventsActive }),
    [moonEnabled, eventsActive],
  );

  // The "currently-viewed slide does not shift when others appear /
  // disappear" rule per plan/slides.md. We track the prior visible list
  // + index and reconcile when visibility flips so the user stays on
  // the same slide id.
  const prevVisibleRef = useRef(visibleSlides);
  const prevIndexRef = useRef(0);
  const [direction, setDirection] = useState<WrapDirection>('next');

  const reconciled = reconcileCurrentSlideIndex(
    prevVisibleRef.current,
    prevIndexRef.current,
    visibleSlides,
  );
  // Track index in a ref + a mirror state so the render uses the
  // reconciled index immediately on prop change without a stale
  // double-render.
  const [currentIndex, setCurrentIndex] = useState(reconciled);

  if (prevVisibleRef.current !== visibleSlides && reconciled !== currentIndex) {
    // Sync state to the reconciled index when the visibility list
    // changes mid-life. React 18 batches this so it does not loop.
    setCurrentIndex(reconciled);
  }
  prevVisibleRef.current = visibleSlides;
  prevIndexRef.current = currentIndex;

  const safeIndex = Math.min(
    currentIndex,
    Math.max(0, visibleSlides.length - 1),
  );
  const currentSlideId = visibleSlides[safeIndex] ?? 'today';
  const currentMeta = SLIDE_META[currentSlideId];
  const currentBackground = currentMeta.background(themeMode);

  // ---- Cube transition machinery ----
  //
  // PowerPoint-style cube transition: from-slide and to-slide live on
  // adjacent faces of a shared cube. The cube wrapper rotates as a
  // whole; faces stay statically positioned in cube-local space. This
  // is a hinge transition (faces share an edge), not a per-slide flip.
  //
  // Layout in cube-local space:
  //   - cube origin sits at z = -W/2 (pushed back behind the deck plane)
  //   - front face: translateZ(W/2)              → world z = 0 (deck plane)
  //   - right face: rotateY(90) translateZ(W/2)  → world (W/2, 0, -W/2)
  //   - left  face: rotateY(-90) translateZ(W/2) → world (-W/2, 0, -W/2)
  //
  // For a 'next' click, cube rotates from rotateY(0) → rotateY(-90):
  //   - front face (from-slide) sweeps from world center to (-W/2, 0, -W/2)
  //   - right face (to-slide) sweeps from (W/2, 0, -W/2) to world center
  // After the rotation completes we snap the cube back to rotateY(0)
  // and re-render with the to-slide alone on the front face — no
  // visual jump because the to-slide's world transform is identical
  // before and after the snap (cube -90 + slide-on-right is the same
  // as cube 0 + slide-on-front).

  const deckRef = useRef<HTMLDivElement>(null);
  const [deckWidth, setDeckWidth] = useState(0);

  useEffect(() => {
    const node = deckRef.current;
    if (!node) return;
    const update = (): void => setDeckWidth(node.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const [transition, setTransition] = useState<Transition | null>(null);
  const cubeControls = useAnimationControls();
  const animTokenRef = useRef(0);

  // Keep the cube origin push-back current as the deck resizes. Snap
  // (no animation) so a window resize doesn't accidentally trigger a
  // mid-flight rotation.
  useEffect(() => {
    cubeControls.set({ z: -deckWidth / 2 });
  }, [deckWidth, cubeControls]);

  const navigate = useCallback(
    (dir: WrapDirection) => {
      const fromSlideId = visibleSlides[safeIndex] ?? 'today';
      const token = ++animTokenRef.current;
      setDirection(dir);
      setCurrentIndex((idx) => wrapStep(idx, visibleSlides.length, dir));
      setTransition({ fromSlideId, direction: dir });
      // Reset cube rotation in case a previous animation is still
      // in-flight (rapid clicks). The new rotation always starts from
      // rotateY(0) so the from-slide is at the front face position.
      cubeControls.set({ rotateY: 0, z: -deckWidth / 2 });
      void cubeControls
        .start(
          {
            rotateY: dir === 'next' ? -90 : 90,
            z: -deckWidth / 2,
          },
          {
            duration: SLIDE_TRANSITION_DURATION_S,
            ease: [0.42, 0, 0.58, 1],
          },
        )
        .then(() => {
          // Stale animation guard: if a newer click superseded this
          // one, leave its state alone.
          if (animTokenRef.current !== token) return;
          cubeControls.set({ rotateY: 0, z: -deckWidth / 2 });
          setTransition(null);
        });
    },
    [visibleSlides, safeIndex, deckWidth, cubeControls],
  );

  const handlePrev = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // Plan/window.md: "Arrow buttons exempt from double-click."
      // Stop propagation so the panel-level click classifier never
      // sees the arrow click and never builds it into a double-click.
      e.stopPropagation();
      navigate('prev');
    },
    [navigate],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      navigate('next');
    },
    [navigate],
  );

  // Slide currently shown on the front face: from-slide while
  // transitioning, current-slide when idle.
  const frontSlideId = transition?.fromSlideId ?? currentSlideId;
  // Side-face slide is the current (incoming) slide, only rendered
  // during a transition.
  const sideFaceSide = transition
    ? transition.direction === 'next'
      ? 'right'
      : 'left'
    : null;

  return (
    <div
      ref={deckRef}
      data-testid="slide-deck"
      data-current-slide-id={currentSlideId}
      data-current-slide-index={String(safeIndex)}
      data-visible-slide-count={String(visibleSlides.length)}
      data-direction={direction}
      data-transition-duration-s={String(SLIDE_TRANSITION_DURATION_S)}
      style={{
        position: 'absolute',
        inset: 0,
        // 3D perspective so the cube rotation reads as a true 3D turn
        // rather than a flat skew. Tighter perspective (smaller value)
        // gives more pronounced foreshortening — at 1200 px the
        // rotation looked nearly flat; 600 px exaggerates the cube
        // reading without crossing into fish-eye territory.
        perspective: '600px',
        transformStyle: 'preserve-3d',
        overflow: 'hidden',
      }}
    >
      {/* The cube wrapper. Stays mounted across transitions so the
          rotation animation isn't restarted by a remount. The wrapper's
          rotateY is driven by `cubeControls`; faces inside it are
          positioned statically in cube-local space. */}
      <motion.div
        data-testid="slide-deck-cube"
        animate={cubeControls}
        initial={{ rotateY: 0, z: 0 }}
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
        }}
      >
        <SlideFace
          slideId={frontSlideId}
          themeMode={themeMode}
          face="front"
          deckWidth={deckWidth}
          forecast={forecast}
          timeFormat={timeFormat}
        />
        {transition && sideFaceSide ? (
          <SlideFace
            slideId={currentSlideId}
            themeMode={themeMode}
            face={sideFaceSide}
            deckWidth={deckWidth}
            forecast={forecast}
            timeFormat={timeFormat}
          />
        ) : null}
      </motion.div>

      <button
        type="button"
        data-testid="slide-deck-arrow-prev"
        aria-label="Previous slide"
        onClick={handlePrev}
        style={{
          ...arrowButtonBaseStyle,
          left: ARROW_INSET_PX,
        }}
      >
        <ChevronLeft
          size={ARROW_SIZE_PX - 8}
          color={arrowGlyphColor(currentBackground.luminance)}
        />
      </button>

      <button
        type="button"
        data-testid="slide-deck-arrow-next"
        aria-label="Next slide"
        onClick={handleNext}
        style={{
          ...arrowButtonBaseStyle,
          right: ARROW_INSET_PX,
        }}
      >
        <ChevronRight
          size={ARROW_SIZE_PX - 8}
          color={arrowGlyphColor(currentBackground.luminance)}
        />
      </button>

      <SlideIndicator
        currentIndex={safeIndex}
        slideCount={visibleSlides.length}
        backgroundLuminance={currentBackground.luminance}
      />
    </div>
  );
}

type SlideFaceProps = {
  slideId: SlideId;
  themeMode: ThemeMode;
  // Which face of the cube this slide is mounted on.
  face: 'front' | 'right' | 'left';
  deckWidth: number;
  forecast: Forecast | null;
  timeFormat: TimeFormat;
};

function SlideFace({
  slideId,
  themeMode,
  face,
  deckWidth,
  forecast,
  timeFormat,
}: SlideFaceProps): JSX.Element {
  const meta = SLIDE_META[slideId];
  const bg = meta.background(themeMode);
  const halfW = deckWidth / 2;
  const transform =
    face === 'front'
      ? `translateZ(${halfW}px)`
      : face === 'right'
        ? `rotateY(90deg) translateZ(${halfW}px)`
        : `rotateY(-90deg) translateZ(${halfW}px)`;

  // M6 wires the today + seven-day slides to real forecast data. The
  // remaining slides (current, moon, events, settings) keep their M4
  // placeholder label until their respective milestones land.
  const body = renderSlideBody({
    slideId,
    forecast,
    timeFormat,
    label: meta.label,
  });

  return (
    <div
      data-testid={`slide-${slideId}`}
      data-slide-id={slideId}
      data-slide-luminance={bg.luminance}
      data-slide-face={face}
      style={{
        position: 'absolute',
        inset: 0,
        background: bg.color,
        color:
          bg.luminance === 'light'
            ? 'rgba(15, 23, 42, 0.85)'
            : 'rgba(255, 255, 255, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: SLIDE_TOP_PADDING_PX,
        paddingBottom: SLIDE_BOTTOM_PADDING_PX,
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        // White outline on each slide's edges so the cube rotation is
        // visually traceable — without this, identical dark backgrounds
        // on adjacent slides make the rotation hard to perceive. Box-
        // sizing border-box keeps the border inside the slide's bounds
        // so it doesn't expand the rotation footprint.
        border: '1px solid rgba(255, 255, 255, 0.9)',
        boxSizing: 'border-box',
        // Hide the back of each face so a face rotated past 90° doesn't
        // render its mirror image (which would break the cube illusion).
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform,
      }}
    >
      {body}
    </div>
  );
}

function renderSlideBody({
  slideId,
  forecast,
  timeFormat,
  label,
}: {
  slideId: SlideId;
  forecast: Forecast | null;
  timeFormat: TimeFormat;
  label: string;
}): JSX.Element | string {
  switch (slideId) {
    case 'today':
      return <TodaySlide forecast={forecast} timeFormat={timeFormat} />;
    case 'seven-day':
      return <SevenDaySlide forecast={forecast} />;
    default:
      return label;
  }
}

const arrowButtonBaseStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: ARROW_SIZE_PX,
  height: ARROW_SIZE_PX,
  borderRadius: '50%',
  background: 'rgba(0, 0, 0, 0.25)',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  // Above the slide content but below the title-bar overlay.
  zIndex: 5,
};

function arrowGlyphColor(luminance: SlideBackgroundLuminance): string {
  return luminance === 'light'
    ? 'rgba(15, 23, 42, 0.7)'
    : 'rgba(255, 255, 255, 0.85)';
}
