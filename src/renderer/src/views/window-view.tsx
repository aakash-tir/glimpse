import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ICON_SIZE } from '../../../shared/icon-position';
import { TitleBar } from '../components/title-bar';
import { useClickClassifier } from '../components/use-click-classifier';
import { DragModeGlow } from '../components/drag-mode-glow';

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
  const handlePanelClick = useClickClassifier({
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

  // Animation target state. When collapsing, we shrink to the same
  // icon-relative scale around the exit anchor; otherwise we sit at
  // scale=1.
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
        background: 'rgba(15, 23, 42, 0.92)',
        color: 'rgba(255, 255, 255, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transformOrigin,
        // DragModeGlow's wrapper sets pointer-events: none (so the
        // glow halo doesn't intercept clicks meant for ancestors —
        // important for IconView's outer click handler). Re-enable
        // it on the panel so the double-click-to-toggle-drag and
        // mousedown-drag handlers below still fire.
        pointerEvents: 'auto',
      }}
    >
      Glimpse
    </motion.div>
  );

  return (
    <div
      data-testid="window-view-root"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
      }}
    >
      {dragMode ? <DragModeGlow fill>{panelInner}</DragModeGlow> : panelInner}
      <TitleBar
        background="dark"
        disabled={dragMode}
        onWeatherIconClick={() => void startCollapse()}
        onMinimize={() => void startCollapse()}
        onRelocate={() => void startCollapse({ resetToDefault: true })}
        onClose={handleClose}
      />
    </div>
  );
}
