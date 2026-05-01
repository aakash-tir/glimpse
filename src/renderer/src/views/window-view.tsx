import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ICON_SIZE } from '../../../shared/icon-position';

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

// WindowView — the expanded panel placeholder. Real slide content lands
// in M4 (slide framework). Click-anywhere-to-collapse is a temporary
// affordance until the title-bar buttons land.
export function WindowView({
  enterAnchor,
  enterBounds,
}: WindowViewProps): JSX.Element {
  const handleCollapse = useCallback(() => {
    void window.glimpse?.collapse();
  }, []);

  // If we know the entry anchor + bounds, animate scale-from-icon.
  // Otherwise (initial mount) skip the animation.
  const hasAnimation = enterAnchor !== null && enterBounds !== null;
  const initialScale = hasAnimation
    ? ICON_SIZE / Math.max(enterBounds.width, enterBounds.height)
    : 1;
  const transformOrigin = hasAnimation
    ? `${enterAnchor.x}px ${enterAnchor.y}px`
    : '50% 50%';

  return (
    <motion.div
      data-testid="window-view"
      data-enter-anchor-x={enterAnchor?.x ?? ''}
      data-enter-anchor-y={enterAnchor?.y ?? ''}
      data-enter-scale={initialScale}
      data-window-scale-duration-s={WINDOW_SCALE_DURATION_S}
      onClick={handleCollapse}
      initial={hasAnimation ? { scale: initialScale } : false}
      animate={{ scale: 1 }}
      transition={{ duration: WINDOW_SCALE_DURATION_S, ease: 'easeOut' }}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.92)',
        color: 'rgba(255, 255, 255, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transformOrigin,
      }}
    >
      Glimpse
    </motion.div>
  );
}
