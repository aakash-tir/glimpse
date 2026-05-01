import { motion } from 'framer-motion';

// Soft white outer glow with a 1 Hz opacity pulse. Sits behind the icon
// glyph and outside its bounds (-12 px inset) so the glyph itself is not
// occluded. Pointer events disabled so it doesn't interfere with the
// icon's own click / drag handling.
export const GLOW_PULSE_DURATION_S = 1;

export function DragModeGlow(): JSX.Element {
  return (
    <motion.div
      data-testid="drag-mode-glow"
      data-glow-pulse-duration-s={GLOW_PULSE_DURATION_S}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: GLOW_PULSE_DURATION_S,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        position: 'absolute',
        inset: -12,
        borderRadius: '50%',
        boxShadow: '0 0 12px 4px rgba(255, 255, 255, 0.85)',
        pointerEvents: 'none',
      }}
    />
  );
}
