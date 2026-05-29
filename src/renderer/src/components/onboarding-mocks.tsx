// Mock UI elements + animated cursor for the onboarding tutorial. The
// tutorial demonstrates gestures on these mocks inside the panel rather
// than driving the live app (see plan/onboarding.md § Rendering
// surface). Each mock calls `onGesture` when the taught gesture is
// performed, which advances the step.

import { type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Minus, X } from 'lucide-react';
import { WiDaySunny } from 'react-icons/wi';
import type { OnboardingStepId } from '../../../shared/onboarding';
import { SadCloud } from './sad-cloud';

// ---- Animated cursor ---------------------------------------------------

export type CursorGesture = 'click' | 'double-click' | 'drag';

/**
 * A pointer that loops the taught gesture in place with a click ripple.
 * Positioned by its parent (absolute); `gesture` controls the ripple
 * cadence (one pulse for click, a quick pair for double-click) and, for
 * drag, a back-and-forth translate.
 */
export function AnimatedCursor({
  gesture,
}: {
  gesture: CursorGesture;
}): JSX.Element {
  const dragShift =
    gesture === 'drag' ? { x: [0, 18, 0], y: [0, 18, 0] } : { x: 0, y: 0 };
  return (
    <motion.div
      data-testid="onboarding-cursor"
      data-gesture={gesture}
      aria-hidden="true"
      animate={dragShift}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        left: '50%',
        top: '60%',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    >
      {/* Ripple */}
      <motion.span
        animate={
          gesture === 'double-click'
            ? { scale: [0, 1.4, 0, 1.4, 0], opacity: [0.5, 0, 0.5, 0, 0] }
            : { scale: [0, 1.4, 0], opacity: [0.5, 0, 0] }
        }
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: -14,
          top: -14,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.55)',
        }}
      />
      {/* Pointer arrow */}
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path
          d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z"
          fill="#fff"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="0.8"
        />
      </svg>
    </motion.div>
  );
}

// ---- Per-step mock -----------------------------------------------------

const mockBox: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
};

function GlassTile({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        ...mockBox,
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        color: 'rgba(255, 255, 255, 0.92)',
      }}
    >
      {children}
    </div>
  );
}

/** The mock the step spotlights; performing its gesture calls onGesture. */
export function OnboardingMock({
  stepId,
  onGesture,
}: {
  stepId: OnboardingStepId;
  onGesture: () => void;
}): JSX.Element | null {
  switch (stepId) {
    case 'welcome':
      return (
        <button
          data-testid="mock-icon"
          onClick={onGesture}
          style={{
            ...mockBox,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <WiDaySunny size="70%" color="#fde68a" />
        </button>
      );
    case 'slides':
      return (
        <div style={{ ...mockBox, gap: 10 }}>
          <button
            data-testid="mock-arrow-left"
            onClick={onGesture}
            style={arrowStyle}
          >
            ‹
          </button>
          <div style={{ flex: 1 }}>
            <GlassTile>•••</GlassTile>
          </div>
          <button
            data-testid="mock-arrow-right"
            onClick={onGesture}
            style={arrowStyle}
          >
            ›
          </button>
        </div>
      );
    case 'switch':
      return <MockTitleBar variant="switch" onGesture={onGesture} />;
    case 'minimize':
      return <MockTitleBar variant="minimize" onGesture={onGesture} />;
    case 'drag':
      return (
        <button
          data-testid="mock-draggable"
          onDoubleClick={onGesture}
          style={{
            ...mockBox,
            border: 'none',
            background: 'transparent',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              width: '70%',
              height: '70%',
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 0 14px 4px rgba(255, 255, 255, 0.35)',
            }}
          />
        </button>
      );
    case 'resize':
      return <MockResizeFrame onGesture={onGesture} />;
    case 'offline':
      // A sample sad-cloud rendered inside the overlay — NOT the live
      // icon (the user is normally online during onboarding).
      return (
        <div style={mockBox}>
          <SadCloud size={84} />
        </div>
      );
    default:
      // settings is handled by the controller directly (no mock).
      return null;
  }
}

const arrowStyle: CSSProperties = {
  border: 'none',
  borderRadius: '50%',
  width: 28,
  height: 28,
  background: 'rgba(255, 255, 255, 0.16)',
  color: 'rgba(255, 255, 255, 0.92)',
  fontSize: 16,
  cursor: 'pointer',
};

function MockTitleBar({
  variant,
  onGesture,
}: {
  variant: 'switch' | 'minimize';
  onGesture: () => void;
}): JSX.Element {
  return (
    <div style={{ ...mockBox, flexDirection: 'column' }}>
      <div
        data-testid="mock-title-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '4px 6px',
          borderRadius: '10px 10px 0 0',
          background: 'rgba(15, 23, 42, 0.96)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'rgba(255, 255, 255, 0.92)',
        }}
      >
        <button
          data-testid="mock-titlebar-icon"
          onClick={variant === 'switch' ? onGesture : undefined}
          style={iconBtnStyle}
        >
          <WiDaySunny size={16} color="#fde68a" />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
          Glimpse
        </span>
        <button
          data-testid="mock-titlebar-minimize"
          onClick={variant === 'minimize' ? onGesture : undefined}
          style={iconBtnStyle}
        >
          <Minus size={12} />
        </button>
        <span style={iconBtnStyle}>
          <X size={12} />
        </span>
      </div>
      <div style={{ flex: 1, width: '100%' }}>
        <GlassTile>{''}</GlassTile>
      </div>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'rgba(255, 255, 255, 0.92)',
  cursor: 'pointer',
  padding: 2,
};

function MockResizeFrame({
  onGesture,
}: {
  onGesture: () => void;
}): JSX.Element {
  const handle = (testId: string, pos: CSSProperties): JSX.Element => (
    <button
      data-testid={testId}
      onClick={onGesture}
      style={{
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.25)',
        cursor: 'nwse-resize',
        ...pos,
      }}
    />
  );
  return (
    <div style={mockBox}>
      <div
        style={{
          position: 'relative',
          width: '70%',
          height: '70%',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
        }}
      >
        {handle('mock-resize-tl', { left: -6, top: -6 })}
        {handle('mock-resize-tr', { right: -6, top: -6 })}
        {handle('mock-resize-bl', { left: -6, bottom: -6 })}
        {handle('mock-resize-br', { right: -6, bottom: -6 })}
      </div>
    </div>
  );
}
