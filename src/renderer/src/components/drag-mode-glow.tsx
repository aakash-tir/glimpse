import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// Soft white outer glow with a 1 Hz pulse. Implemented as a CSS
// drop-shadow filter on a wrapper around the icon glyph so the halo
// follows the icon's alpha silhouette (rather than producing a ring
// around its bounding box, which leaves a visible hard edge where the
// box ends).
export const GLOW_PULSE_DURATION_S = 1;

const GLOW_LOW = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.65))';
const GLOW_HIGH = 'drop-shadow(0 0 14px rgba(255, 255, 255, 1))';

export function DragModeGlow({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <motion.div
      data-testid="drag-mode-glow"
      data-glow-pulse-duration-s={GLOW_PULSE_DURATION_S}
      initial={{ filter: GLOW_LOW }}
      animate={{ filter: [GLOW_LOW, GLOW_HIGH, GLOW_LOW] }}
      transition={{
        duration: GLOW_PULSE_DURATION_S,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}
