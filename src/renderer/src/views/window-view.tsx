import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ICON_SIZE } from '../../../shared/icon-position';
import { TitleBar } from '../components/title-bar';
import { useClickClassifier } from '../components/use-click-classifier';
import { DragModeGlow } from '../components/drag-mode-glow';
import { ResizeHandles } from '../components/resize-handles';
import { SlideDeck } from '../components/slide-deck';
import { useDataSnapshot } from '../components/use-data-snapshot';
import { useMoonPhase } from '../components/use-moon-phase';
import { useResolvedTheme } from '../components/use-resolved-theme';
import { useSettings } from '../components/use-settings';

// Plan/styling.md: "Window open / close: scale animation, 200 ms
// ease-out, anchored at the icon's position."
export const WINDOW_SCALE_DURATION_S = 0.2;

export type WindowViewProps = {
  // Local-coord pivot for the entry animation, relative to the window's
  // top-left. Null on the initial app load (no animation).
  enterAnchor: { x: number; y: number } | null;
  // Window bounds at the moment of the mode change, so the renderer can
  // compute the start scale (icon size / window size) without depending
  // on `window.innerWidth`, which momentarily lags `setBounds`.
  enterBounds: { width: number; height: number } | null;
};

type CollapseRequest = {
  opts: { resetToDefault?: boolean };
  exitAnchor: { x: number; y: number };
};

// WindowView — the expanded panel placeholder. Real slide content lands
// in M4. Title-bar buttons trigger collapse via a scale-down animation
// pivoting around the icon's eventual position. Double-clicking the
// panel body toggles window-drag mode (same gesture as the icon's
// drag mode); while drag mode is active, the title bar is disabled
// and mouse-drag moves the window.
export function WindowView({
  enterAnchor,
  enterBounds,
}: WindowViewProps): JSX.Element {
  const [collapse, setCollapse] = useState<CollapseRequest | null>(null);
  // Live settings stream — pushed to every slide that depends on
  // user preferences. Each settings:set in main triggers a broadcast
  // that updates this hook, so the moon-phase visibility, time format,
  // units, etc. all stay in sync without per-consumer re-fetching.
  const settings = useSettings();
  const moonEnabled = settings?.moonPhaseSlideEnabled ?? false;
  const timeFormat = settings?.timeFormat ?? '24h';
  const units = settings?.units ?? 'metric';
  // Forecast snapshot streamed from main via the data-snapshot hook.
  // Null while the first fetch is in flight — slide content components
  // swap in a loading skeleton in that case.
  const snapshot = useDataSnapshot();
  const forecast = snapshot?.forecast ?? null;
  // Live moon-phase reading; recomputes once per minute (much finer
  // than the ~28-day cycle). Drives the M7 moon-phase slide.
  const moonPhase = useMoonPhase();
  // Resolved theme (light / dark) — pushed from main on settings or
  // nativeTheme changes. Drives the Settings slide background palette
  // and the slide-indicator dot color.
  const resolvedTheme = useResolvedTheme();
  // Hides the panel + title bar in the brief window between the scale
  // animation finishing and `mode:changed` arriving from main. Without
  // this, the BrowserWindow resizes to icon-mode bounds while WindowView
  // is still mounted with `width: 100%`, and the transform-origin
  // pixel values (computed in window-mode coords) resolve to a
  // different on-screen position — producing a 1–2 frame visual
  // "jump-then-readjust" right before IconView takes over.
  const [hidden, setHidden] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const isDraggingRef = useRef(false);

  const startCollapse = useCallback(
    async (opts: { resetToDefault?: boolean } = {}) => {
      if (collapse) return;
      const api = window.glimpse;
      if (!api) return;
      const exitAnchor = await api.previewCollapseAnchor(opts);
      setCollapse({ opts, exitAnchor });
    },
    [collapse],
  );

  const handleAnimationComplete = useCallback(() => {
    if (!collapse) return;
    setHidden(true);
    void window.glimpse?.collapse(collapse.opts);
  }, [collapse]);

  const handleClose = useCallback(() => {
    window.glimpse?.quit();
  }, []);

  const handlePanelDoubleClick = useCallback(() => {
    setDragMode((on) => !on);
  }, []);

  // Single-click on the panel does nothing in window mode; the click
  // classifier is here purely to disambiguate double-clicks for drag
  // mode and to absorb stray single clicks.
  const { click: handlePanelClick } = useClickClassifier({
    onSingleClick: () => {
      // Intentionally no-op; outside-click does NOT collapse the window
      // and a panel click should be inert.
    },
    onDoubleClick: handlePanelDoubleClick,
  });

  // Window blur exits drag mode (the user's focus moved elsewhere).
  useEffect(() => {
    if (!dragMode) return;
    const onBlur = (): void => setDragMode(false);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [dragMode]);

  // Mousemove + mouseup are bound at the window level so a fast cursor
  // that briefly outpaces the window doesn't drop the drag.
  useEffect(() => {
    if (!dragMode) return;
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      window.glimpse?.dragMove({ x: e.screenX, y: e.screenY });
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      window.glimpse?.dragEnd({ x: e.screenX, y: e.screenY });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragMode]);

  const handlePanelMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragMode) return;
      e.preventDefault();
      isDraggingRef.current = true;
      window.glimpse?.dragStart({ x: e.screenX, y: e.screenY });
    },
    [dragMode],
  );

  // Animation start state.
  const hasEntryAnimation = enterAnchor !== null && enterBounds !== null;
  const startScale = hasEntryAnimation
    ? ICON_SIZE / Math.max(enterBounds.width, enterBounds.height)
    : 1;

  // Animation target state. When collapsing we shrink the panel
  // toward the exit anchor (where the icon will land) AND fade the
  // whole root to opacity 0 over the same duration. The fade is
  // applied at the root (see motion.div in render) so the panel +
  // title bar dissolve together; pure scale-down concentrates the
  // visible mass at the transform-origin and can read as the panel
  // being flung sideways, which the fade smooths over.
  const collapsing = collapse !== null;
  const targetScale = collapsing
    ? enterBounds
      ? ICON_SIZE / Math.max(enterBounds.width, enterBounds.height)
      : 0.4
    : 1;

  const transformOrigin = collapse
    ? `${collapse.exitAnchor.x}px ${collapse.exitAnchor.y}px`
    : enterAnchor
      ? `${enterAnchor.x}px ${enterAnchor.y}px`
      : '50% 50%';

  const panelInner = (
    <motion.div
      data-testid="window-view"
      data-enter-anchor-x={enterAnchor?.x ?? ''}
      data-enter-anchor-y={enterAnchor?.y ?? ''}
      data-enter-scale={startScale}
      data-collapsing={collapsing ? 'on' : 'off'}
      data-drag-mode={dragMode ? 'on' : 'off'}
      data-exit-anchor-x={collapse?.exitAnchor.x ?? ''}
      data-exit-anchor-y={collapse?.exitAnchor.y ?? ''}
      data-window-scale-duration-s={WINDOW_SCALE_DURATION_S}
      onClick={handlePanelClick}
      onMouseDown={handlePanelMouseDown}
      initial={hasEntryAnimation ? { scale: startScale } : false}
      animate={{ scale: targetScale }}
      transition={{ duration: WINDOW_SCALE_DURATION_S, ease: 'easeOut' }}
      onAnimationComplete={handleAnimationComplete}
      style={{
        width: '100%',
        height: '100%',
        // No panel backdrop — the BrowserWindow's `transparent: true`
        // surface is intentionally exposed during cube transitions, so
        // the desktop wallpaper shows through the gaps between the
        // rotating cube faces. In idle state each slide's background
        // covers the panel; the wallpaper only peeks through during
        // the rotation, which is the desired effect.
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transformOrigin,
      }}
    >
      <SlideDeck
        moonEnabled={moonEnabled}
        eventsActive={false}
        forecast={forecast}
        timeFormat={timeFormat}
        units={units}
        moonPhase={moonPhase}
        settings={settings}
        themeMode={resolvedTheme}
      />
    </motion.div>
  );

  return (
    <motion.div
      data-testid="window-view-root"
      data-hidden={hidden ? 'on' : 'off'}
      animate={{ opacity: collapsing ? 0 : 1 }}
      transition={{ duration: WINDOW_SCALE_DURATION_S, ease: 'easeOut' }}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        // visibility (not display:none) so the still-running
        // motion animation doesn't get yanked mid-frame.
        visibility: hidden ? 'hidden' : 'visible',
      }}
    >
      {/* The panel is always rendered at the same tree position so that
          toggling dragMode does not unmount/remount its motion.div and
          replay the entry scale animation. The glow renders as a
          separate absolutely-positioned overlay sibling. */}
      {panelInner}
      {dragMode ? <DragModeGlow fill /> : null}
      <TitleBar
        background="dark"
        disabled={dragMode}
        onWeatherIconClick={() => void startCollapse()}
        onMinimize={() => void startCollapse({ resetToDefault: true })}
        onClose={handleClose}
      />
      <ResizeHandles />
    </motion.div>
  );
}
