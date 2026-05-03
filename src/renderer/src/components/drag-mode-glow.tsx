import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

// Soft white outer glow with a 1 Hz pulse. Two implementations behind
// one component:
//
//   - Icon mode (fill = false): wraps the glyph and applies a
//     drop-shadow CSS filter. drop-shadow follows the glyph's alpha
//     silhouette and bleeds into the surrounding transparent window,
//     producing a real outer halo.
//   - Window mode (fill = true): renders as an absolutely-positioned
//     overlay sibling and uses inset box-shadow to paint a glow ring
//     INSIDE the panel along its edges. The window panel fills the
//     whole BrowserWindow, so a drop-shadow would be clipped at the
//     window boundary — leaving only the inner bleed visible, which
//     reads as the panel changing color rather than gaining a halo.
//     An inset shadow side-steps the clipping.
export const GLOW_PULSE_DURATION_S = 1;

// Icon-mode pulse: drop-shadow filter on the glyph wrapper.
const GLYPH_GLOW_LOW =
  'drop-shadow(0 0 8px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.6))';
const GLYPH_GLOW_HIGH =
  'drop-shadow(0 0 14px rgba(255, 255, 255, 1)) drop-shadow(0 0 26px rgba(255, 255, 255, 0.85))';

// Window-mode pulse: inset box-shadow paints a ring along the panel's
// inner edge. The tight ring (small blur, small spread) gives the
// crisp outline; the wider ring (larger blur, larger spread) is the
// soft body of the glow that bleeds inward. Pulsing animates both.
const FILL_GLOW_LOW =
  'inset 0 0 12px 2px rgba(255, 255, 255, 0.7), inset 0 0 24px 6px rgba(255, 255, 255, 0.35)';
const FILL_GLOW_HIGH =
  'inset 0 0 16px 3px rgba(255, 255, 255, 0.95), inset 0 0 32px 10px rgba(255, 255, 255, 0.55)';

export function DragModeGlow({
  children,
  fill = false,
}: {
  children?: ReactNode;
  fill?: boolean;
}): JSX.Element {
  if (fill) {
    return (
      <motion.div
        data-testid="drag-mode-glow"
        data-glow-pulse-duration-s={GLOW_PULSE_DURATION_S}
        data-glow-variant="fill"
        initial={{ boxShadow: FILL_GLOW_LOW }}
        animate={{ boxShadow: [FILL_GLOW_LOW, FILL_GLOW_HIGH, FILL_GLOW_LOW] }}
        transition={{
          duration: GLOW_PULSE_DURATION_S,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          inset: 0,
          // Above the panel content so the inset ring is visible, but
          // pointer-events:none so panel double-click + mousedown still
          // reach the panel underneath.
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />
    );
  }
  return (
    <motion.div
      data-testid="drag-mode-glow"
      data-glow-pulse-duration-s={GLOW_PULSE_DURATION_S}
      data-glow-variant="glyph"
      initial={{ filter: GLYPH_GLOW_LOW }}
      animate={{ filter: [GLYPH_GLOW_LOW, GLYPH_GLOW_HIGH, GLYPH_GLOW_LOW] }}
      transition={{
        duration: GLOW_PULSE_DURATION_S,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Pass clicks through to the wrapped glyph.
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}
