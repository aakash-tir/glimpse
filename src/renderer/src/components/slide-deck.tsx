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
import type { MoonPhase } from '../../../shared/astro';
import type { DataLocation } from '../../../shared/data-snapshot';
import type { Forecast } from '../../../shared/forecast';
import type {
  Settings,
  TimeFormat,
  Units,
} from '../../../shared/settings-store';
import {
  computeVisibleSlides,
  isStaticSlideId,
  reconcileCurrentSlideIndex,
  wrapStep,
  type EventSlideId,
  type SlideId,
  type StaticSlideId,
  type WrapDirection,
} from '../../../shared/slides';
import type { SpecialEvent } from '../../../shared/special-events';
import { CurrentSlide } from './current-slide';
import { EventSlide } from './event-slide';
import { MoonSlide } from './moon-slide';
import { SettingsSlide } from './settings-slide';
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

// Plan/styling.md: "Theme switches use a 200 ms cross-fade between
// palettes." Applied to the slide-face background + foreground when
// the SlideDeck's themeMode prop changes (or, transitively, when
// useResolvedTheme pushes a new value).
export const THEME_TRANSITION_DURATION_S = 0.2;

// Title bar trigger zone sits at the top, dot indicator hugs the
// bottom; slide content reserves space for both so placeholder text
// sits in the optical center of the *visible* slide area.
const SLIDE_TOP_PADDING_PX = 32;
const SLIDE_BOTTOM_PADDING_PX = 32;

// Plan/slides.md: prev / next arrow buttons sit in the bottom
// navigation bar, flanking the slide-indicator dots — not on the panel
// side edges. Single horizontal control row pinned to the bottom.
const NAV_BAR_BOTTOM_INSET_PX = 6;
const NAV_BAR_GAP_PX = 14;
const ARROW_SIZE_PX = 24;

// Plan/styling.md: backgrounds per slide. Settings is the only
// theme-adaptive surface; all others stay dark. Theme-resolution wires
// up live in M7 — for M4, a `themeMode` prop selects between the two
// Settings palettes so the dot-color rule (light dots on dark slides,
// dark dots on light Settings) is reachable in tests today.
const BG_DARK_GLASS = 'rgba(15, 23, 42, 0.92)';
const BG_MOON = '#0a1628';
const BG_SETTINGS_DARK = '#0f172a';
const BG_SETTINGS_LIGHT = '#f8fafc';

export type ThemeMode = 'light' | 'dark';

export type { SlideBackgroundLuminance };

// Module-level constant so the default `events` prop has a stable
// reference across renders. Without this, the empty-array default
// would produce a new reference each render, invalidating useMemo
// dependencies and tripping the reconcileCurrentSlideIndex path on
// every commit.
const EMPTY_EVENTS: readonly SpecialEvent[] = Object.freeze([]);

type StaticSlideMeta = {
  id: StaticSlideId;
  label: string;
  background: (themeMode: ThemeMode) => {
    color: string;
    luminance: SlideBackgroundLuminance;
  };
};

const STATIC_SLIDE_META: Record<StaticSlideId, StaticSlideMeta> = {
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
  settings: {
    id: 'settings',
    label: 'Settings',
    background: (themeMode) =>
      themeMode === 'light'
        ? { color: BG_SETTINGS_LIGHT, luminance: 'light' }
        : { color: BG_SETTINGS_DARK, luminance: 'dark' },
  },
};

// Plan/slides.md: special-event backgrounds always stay celestial-dark
// regardless of the user's theme setting. SLIDE_META lookup folds these
// into the same shape as the static slides.
const EVENT_BACKGROUND_BY_TYPE: Record<SpecialEvent['type'], string> = {
  aurora: '#0a2e1f',
  meteor: '#0a0a1f',
  eclipse: '#1a0a0a',
  'blood-moon': '#2a0a05',
};

function backgroundForSlideId(
  id: SlideId,
  themeMode: ThemeMode,
  events: readonly SpecialEvent[],
): { color: string; luminance: SlideBackgroundLuminance } {
  if (isStaticSlideId(id)) {
    return STATIC_SLIDE_META[id].background(themeMode);
  }
  const event = events.find((e) => e.id === id);
  const color = event
    ? EVENT_BACKGROUND_BY_TYPE[event.type]
    : EVENT_BACKGROUND_BY_TYPE.meteor;
  return { color, luminance: 'dark' };
}

export type SlideDeckProps = {
  // Visibility flags fed into the dynamic-count math. Defaults make the
  // deck render the no-moon-no-events state.
  moonEnabled?: boolean;
  /**
   * Active special events, already ordered today-first then
   * alphabetical-by-type by computeActiveEvents. The deck renders one
   * slide per entry between the moon (or current) slide and settings.
   * Empty list = no event slides.
   */
  events?: readonly SpecialEvent[];
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
  // Metric / imperial unit preference. Forwarded to CurrentSlide for
  // wind speed + feels-like temperature unit suffix.
  units?: Units;
  // Current moon phase (computed via SunCalc in the host view). Null
  // while waiting for the initial useEffect to fire — MoonSlide shows
  // a loading skeleton in that brief window.
  moonPhase?: MoonPhase | null;
  // Full settings snapshot, forwarded to the Settings slide so each
  // control can show its current value. Null until useSettings()
  // resolves on first mount.
  settings?: Settings | null;
  // Geolocation + last-updated timestamp from the data snapshot,
  // surfaced as a small subtitle on the Current slide so the user
  // can verify where Open-Meteo geolocated to and how fresh the
  // current data is.
  location?: DataLocation | null;
  lastUpdated?: string | null;
  /**
   * IP-detected city — lookup key for the active location override
   * in the Settings → Advanced location form. May differ from
   * `location.city` when an override is active.
   */
  detectedCity?: string | null;
  /**
   * Slide to open on (first mount only). Used by the onboarding
   * completion handoff to land the window on Settings.
   */
  initialSlideId?: SlideId;
};

type Transition = {
  fromSlideId: SlideId;
  direction: WrapDirection;
};

export function SlideDeck({
  moonEnabled = false,
  events = EMPTY_EVENTS,
  themeMode = 'dark',
  forecast = null,
  timeFormat = '24h',
  units = 'metric',
  moonPhase = null,
  settings = null,
  location = null,
  lastUpdated = null,
  detectedCity = null,
  initialSlideId,
}: SlideDeckProps): JSX.Element {
  // Stable key derived from event ids so memo deps don't depend on
  // the `events` array's reference identity — callers that pass
  // `events={[]}` (or a freshly mapped list each render) would
  // otherwise re-trigger the reconcile-during-render path on every
  // commit and crash with "Too many re-renders".
  const eventIdsKey = events.map((e) => e.id).join('|');
  const eventSlideIds = useMemo<readonly EventSlideId[]>(
    () => events.map((e) => e.id as EventSlideId),
    // We intentionally key off the joined ids string rather than the
    // events array reference. The lint rule can't statically verify
    // that — disable narrowly here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventIdsKey],
  );
  const visibleSlides = useMemo(
    () => computeVisibleSlides({ moonEnabled, eventSlideIds }),
    [moonEnabled, eventSlideIds],
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
  // double-render. `initialSlideId` (onboarding completion handoff)
  // overrides the starting index on first mount only.
  const [currentIndex, setCurrentIndex] = useState(() =>
    initialSlideId
      ? Math.max(0, visibleSlides.indexOf(initialSlideId))
      : reconciled,
  );

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
  const currentBackground = backgroundForSlideId(
    currentSlideId,
    themeMode,
    events,
  );

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
      data-theme-mode={themeMode}
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
          units={units}
          moonPhase={moonPhase}
          settings={settings}
          location={location}
          lastUpdated={lastUpdated}
          detectedCity={detectedCity}
          events={events}
        />
        {transition && sideFaceSide ? (
          <SlideFace
            slideId={currentSlideId}
            themeMode={themeMode}
            face={sideFaceSide}
            deckWidth={deckWidth}
            forecast={forecast}
            timeFormat={timeFormat}
            units={units}
            moonPhase={moonPhase}
            settings={settings}
            location={location}
            lastUpdated={lastUpdated}
            detectedCity={detectedCity}
            events={events}
          />
        ) : null}
      </motion.div>

      <div
        data-testid="slide-deck-nav-bar"
        style={{
          position: 'absolute',
          bottom: NAV_BAR_BOTTOM_INSET_PX,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: NAV_BAR_GAP_PX,
          zIndex: 5,
          // Default pointer-events so the arrows are clickable; the
          // SlideIndicator's container sets pointer-events: none on
          // itself so dots don't intercept stray clicks between them.
        }}
      >
        <button
          type="button"
          data-testid="slide-deck-arrow-prev"
          aria-label="Previous slide"
          onClick={handlePrev}
          style={arrowButtonStyle}
        >
          <ChevronLeft
            size={ARROW_SIZE_PX - 8}
            color={arrowGlyphColor(currentBackground.luminance)}
          />
        </button>

        <SlideIndicator
          currentIndex={safeIndex}
          slideCount={visibleSlides.length}
          backgroundLuminance={currentBackground.luminance}
        />

        <button
          type="button"
          data-testid="slide-deck-arrow-next"
          aria-label="Next slide"
          onClick={handleNext}
          style={arrowButtonStyle}
        >
          <ChevronRight
            size={ARROW_SIZE_PX - 8}
            color={arrowGlyphColor(currentBackground.luminance)}
          />
        </button>
      </div>
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
  units: Units;
  moonPhase: MoonPhase | null;
  settings: Settings | null;
  location: DataLocation | null;
  lastUpdated: string | null;
  detectedCity: string | null;
  events: readonly SpecialEvent[];
};

function SlideFace({
  slideId,
  themeMode,
  face,
  deckWidth,
  forecast,
  timeFormat,
  units,
  moonPhase,
  settings,
  location,
  lastUpdated,
  detectedCity,
  events,
}: SlideFaceProps): JSX.Element {
  const bg = backgroundForSlideId(slideId, themeMode, events);
  const halfW = deckWidth / 2;
  const transform =
    face === 'front'
      ? `translateZ(${halfW}px)`
      : face === 'right'
        ? `rotateY(90deg) translateZ(${halfW}px)`
        : `rotateY(-90deg) translateZ(${halfW}px)`;

  const body = renderSlideBody({
    slideId,
    forecast,
    timeFormat,
    units,
    moonPhase,
    settings,
    location,
    lastUpdated,
    detectedCity,
    luminance: bg.luminance,
    events,
  });

  const textColor =
    bg.luminance === 'light'
      ? 'rgba(15, 23, 42, 0.85)'
      : 'rgba(255, 255, 255, 0.85)';

  return (
    <motion.div
      data-testid={`slide-${slideId}`}
      data-slide-id={slideId}
      data-slide-luminance={bg.luminance}
      data-slide-face={face}
      data-theme-transition-duration-s={String(THEME_TRANSITION_DURATION_S)}
      // Plan/styling.md: theme switches cross-fade between palettes
      // over 200 ms. Animating both background + text color in sync
      // keeps adaptive luminance text from snapping while the panel
      // fades.
      animate={{ backgroundColor: bg.color, color: textColor }}
      transition={{ duration: THEME_TRANSITION_DURATION_S, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        inset: 0,
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
    </motion.div>
  );
}

function renderSlideBody({
  slideId,
  forecast,
  timeFormat,
  units,
  moonPhase,
  settings,
  location,
  lastUpdated,
  detectedCity,
  luminance,
  events,
}: {
  slideId: SlideId;
  forecast: Forecast | null;
  timeFormat: TimeFormat;
  units: Units;
  moonPhase: MoonPhase | null;
  settings: Settings | null;
  location: DataLocation | null;
  lastUpdated: string | null;
  detectedCity: string | null;
  luminance: SlideBackgroundLuminance;
  events: readonly SpecialEvent[];
}): JSX.Element | string {
  if (!isStaticSlideId(slideId)) {
    const event = events.find((e) => e.id === slideId);
    if (!event) return '';
    return (
      <EventSlide
        event={event}
        timeFormat={timeFormat}
        lastUpdated={lastUpdated}
        timeZone={forecast?.timezone ?? null}
      />
    );
  }
  switch (slideId) {
    case 'today':
      return <TodaySlide forecast={forecast} timeFormat={timeFormat} />;
    case 'seven-day':
      return <SevenDaySlide forecast={forecast} />;
    case 'current':
      return (
        <CurrentSlide
          forecast={forecast}
          timeFormat={timeFormat}
          units={units}
          location={location}
          lastUpdated={lastUpdated}
        />
      );
    case 'moon':
      return <MoonSlide phase={moonPhase} />;
    case 'settings':
      return (
        <SettingsSlide
          settings={settings}
          luminance={luminance}
          detectedCity={detectedCity}
        />
      );
  }
}

const arrowButtonStyle: CSSProperties = {
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
  // Buttons live inside the bottom nav bar's flex row — positioning is
  // handled by the parent so no absolute coords here.
  flex: '0 0 auto',
};

function arrowGlyphColor(luminance: SlideBackgroundLuminance): string {
  return luminance === 'light'
    ? 'rgba(15, 23, 42, 0.7)'
    : 'rgba(255, 255, 255, 0.85)';
}
