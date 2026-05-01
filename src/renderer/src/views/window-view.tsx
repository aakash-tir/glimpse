import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { ICON_SIZE } from '../../../shared/icon-position';
import { TitleBar } from '../components/title-bar';

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
// in M4 (slide framework). Title bar buttons trigger collapse via a
// scale-down animation pivoting around the icon's eventual position;
// when the animation completes, the actual collapse IPC fires and main
// resizes the window back to icon-mode bounds.
export function WindowView({
  enterAnchor,
  enterBounds,
}: WindowViewProps): JSX.Element {
  const [collapse, setCollapse] = useState<CollapseRequest | null>(null);

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
    // Fires for both entry and exit animations. We only act when the
    // user has requested a collapse — ignore the entry animation's
    // completion.
    if (!collapse) return;
    void window.glimpse?.collapse(collapse.opts);
    // The mode:changed event will swap App back to IconView; this
    // component will unmount before it re-renders.
  }, [collapse]);

  const handleClose = useCallback(() => {
    window.glimpse?.quit();
  }, []);

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

  // The pivot for the active animation. During collapse we pivot at the
  // exit anchor; otherwise pivot at the entry anchor (or center if
  // neither — the no-animation initial mount case).
  const transformOrigin = collapse
    ? `${collapse.exitAnchor.x}px ${collapse.exitAnchor.y}px`
    : enterAnchor
      ? `${enterAnchor.x}px ${enterAnchor.y}px`
      : '50% 50%';

  return (
    <div
      data-testid="window-view-root"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
      }}
    >
      <motion.div
        data-testid="window-view"
        data-enter-anchor-x={enterAnchor?.x ?? ''}
        data-enter-anchor-y={enterAnchor?.y ?? ''}
        data-enter-scale={startScale}
        data-collapsing={collapsing ? 'on' : 'off'}
        data-exit-anchor-x={collapse?.exitAnchor.x ?? ''}
        data-exit-anchor-y={collapse?.exitAnchor.y ?? ''}
        data-window-scale-duration-s={WINDOW_SCALE_DURATION_S}
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
        }}
      >
        Glimpse
      </motion.div>
      <TitleBar
        background="dark"
        onWeatherIconClick={() => void startCollapse()}
        onMinimize={() => void startCollapse()}
        onRelocate={() => void startCollapse({ resetToDefault: true })}
        onClose={handleClose}
      />
    </div>
  );
}
