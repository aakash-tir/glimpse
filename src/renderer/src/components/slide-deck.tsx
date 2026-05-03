import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  computeVisibleSlides,
  reconcileCurrentSlideIndex,
  wrapStep,
  type SlideId,
  type WrapDirection,
} from '../../../shared/slides';
import {
  SlideIndicator,
  type SlideBackgroundLuminance,
} from './slide-indicator';

// Plan/styling.md: "Cube slide transition: 350 ms ease-in-out, rotates
// in the direction of the arrow click. No reverse-spin on wrap (loops
// continue in click direction)."
export const SLIDE_TRANSITION_DURATION_S = 0.35;

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
};

export function SlideDeck({
  moonEnabled = false,
  eventsActive = false,
  themeMode = 'dark',
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

  const navigate = useCallback(
    (dir: WrapDirection) => {
      setDirection(dir);
      setCurrentIndex((idx) => wrapStep(idx, visibleSlides.length, dir));
    },
    [visibleSlides.length],
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

  return (
    <div
      data-testid="slide-deck"
      data-current-slide-id={currentSlideId}
      data-current-slide-index={String(safeIndex)}
      data-visible-slide-count={String(visibleSlides.length)}
      data-direction={direction}
      data-transition-duration-s={String(SLIDE_TRANSITION_DURATION_S)}
      style={{
        position: 'absolute',
        inset: 0,
        // 3D perspective so rotateY reads as a cube-face turn rather
        // than a flat skew. The deck container hosts the perspective;
        // each slide gets transform-style: preserve-3d.
        perspective: '1200px',
        overflow: 'hidden',
      }}
    >
      {/* Default mode (no `mode="wait"`): the outgoing slide and the
          incoming slide render concurrently for the duration of the
          rotateY animation, which is what a cube turn physically looks
          like — both faces visible during the rotation. */}
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentSlideId}
          data-testid={`slide-${currentSlideId}`}
          data-slide-id={currentSlideId}
          data-slide-luminance={currentBackground.luminance}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: SLIDE_TRANSITION_DURATION_S,
            ease: [0.42, 0, 0.58, 1], // cubic-bezier ease-in-out
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: currentBackground.color,
            color:
              currentBackground.luminance === 'light'
                ? 'rgba(15, 23, 42, 0.85)'
                : 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: SLIDE_TOP_PADDING_PX,
            paddingBottom: SLIDE_BOTTOM_PADDING_PX,
            fontSize: 14,
            fontFamily: 'system-ui, sans-serif',
            transformStyle: 'preserve-3d',
            // Rotation pivots around the deck's vertical axis so each
            // face turns about the deck's center rather than its own
            // edge — matches the physical cube reading in the plan.
            transformOrigin: 'center center',
          }}
        >
          {currentMeta.label}
        </motion.div>
      </AnimatePresence>

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

const slideVariants = {
  enter: (direction: WrapDirection) => ({
    rotateY: direction === 'next' ? 90 : -90,
    opacity: 0,
  }),
  center: {
    rotateY: 0,
    opacity: 1,
  },
  exit: (direction: WrapDirection) => ({
    rotateY: direction === 'next' ? -90 : 90,
    opacity: 0,
  }),
};

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
