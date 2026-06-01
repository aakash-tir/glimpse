// Coachmark / spotlight overlay primitive for onboarding. Renders the
// 60% dim with a rounded spotlight cut-out around a target rect, an
// auto-positioned callout (bold title + description line[s]), the
// step-count dots, a top-right Skip link and a Next button.
//
// Click model (see plan/onboarding.md): a transparent backdrop swallows
// clicks everywhere; the optional `spotlightContent` (the interactive
// mock for the step) is layered above the backdrop at the spotlight
// rect, so only it receives clicks. The dim itself is a separate
// visual-only layer (pointer-events: none) using the box-shadow
// cut-out technique, so the spotlight stays click-through to the mock.

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  calloutPlacement,
  type SpotlightRect,
} from '../../../shared/onboarding-window';

export const COACHMARK_DIM_OPACITY = 0.6;
export const SPOTLIGHT_PAD_PX = 8;
const SPOTLIGHT_RADIUS_PX = 12;
const CALLOUT_GAP_PX = 12;

export type CoachmarkProps = {
  /** Element to spotlight (panel-local px). null → full dim, no cut-out. */
  spotlight: SpotlightRect | null;
  /** Interactive mock placed in the spotlight, above the backdrop. */
  spotlightContent?: ReactNode;
  title: string;
  /** One string, or multiple lines for the two-line steps. */
  description: string | readonly string[];
  /** 0-based index of the current step. */
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onSkip: () => void;
  /** Defaults to "Next"; the final step can pass e.g. "Done". */
  nextLabel?: string;
  /** Extra overlay layers (e.g. the animated cursor). */
  children?: ReactNode;
};

export function Coachmark({
  spotlight,
  spotlightContent,
  title,
  description,
  stepIndex,
  stepCount,
  onNext,
  onSkip,
  nextLabel = 'Next',
  children,
}: CoachmarkProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = (): void => setPanelHeight(root.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const placement = calloutPlacement(spotlight, panelHeight);
  const lines = Array.isArray(description) ? description : [description];

  return (
    <div
      ref={rootRef}
      data-testid="coachmark"
      data-step-index={String(stepIndex)}
      style={{ position: 'absolute', inset: 0, zIndex: 50 }}
    >
      {/* Backdrop — swallows every click that isn't on the spotlit
          mock or the chrome. Transparent; the dim is drawn separately. */}
      <div
        data-testid="coachmark-backdrop"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
        }}
      />

      {/* Visual dim. With a spotlight, a box-shadow cut-out darkens
          everything outside the (padded, rounded) hole; without one,
          a plain full dim. Pointer-events off so it never blocks the
          spotlit mock below it. */}
      {spotlight ? (
        <div
          data-testid="coachmark-spotlight"
          data-spotlight-pad={String(SPOTLIGHT_PAD_PX)}
          style={{
            position: 'absolute',
            left: spotlight.x - SPOTLIGHT_PAD_PX,
            top: spotlight.y - SPOTLIGHT_PAD_PX,
            width: spotlight.width + SPOTLIGHT_PAD_PX * 2,
            height: spotlight.height + SPOTLIGHT_PAD_PX * 2,
            borderRadius: SPOTLIGHT_RADIUS_PX,
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, ${COACHMARK_DIM_OPACITY})`,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          data-testid="coachmark-dim-full"
          style={{
            position: 'absolute',
            inset: 0,
            background: `rgba(0, 0, 0, ${COACHMARK_DIM_OPACITY})`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* The interactive mock for the step, layered above the backdrop
          at the spotlight rect so only it receives clicks. */}
      {spotlight && spotlightContent ? (
        <div
          data-testid="coachmark-spotlight-content"
          style={{
            position: 'absolute',
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.width,
            height: spotlight.height,
            pointerEvents: 'auto',
          }}
        >
          {spotlightContent}
        </div>
      ) : null}

      {/* Callout bubble. */}
      <div
        data-testid="coachmark-callout"
        data-placement={placement}
        style={calloutStyle(spotlight, placement, panelHeight)}
      >
        <div
          data-testid="coachmark-title"
          style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}
        >
          {title}
        </div>
        {lines.map((line, i) => (
          <div key={i} style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
            {line}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 10,
          }}
        >
          <button
            data-testid="coachmark-next"
            onClick={onNext}
            style={{
              pointerEvents: 'auto',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#0f172a',
              background: 'rgba(255, 255, 255, 0.92)',
              cursor: 'pointer',
            }}
          >
            {nextLabel}
          </button>
        </div>
      </div>

      {/* Skip link, top-right. */}
      <button
        data-testid="coachmark-skip"
        onClick={onSkip}
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          border: 'none',
          background: 'transparent',
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 11,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        Skip tutorial
      </button>

      {/* Step dots, bottom-center. */}
      <div
        data-testid="coachmark-dots"
        data-step-count={String(stepCount)}
        style={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: stepCount }, (_, i) => (
          <span
            key={i}
            data-active={i === stepIndex ? 'on' : 'off'}
            style={{
              width: i === stepIndex ? 8 : 6,
              height: i === stepIndex ? 8 : 6,
              borderRadius: '50%',
              background:
                i === stepIndex
                  ? 'rgba(255, 255, 255, 0.95)'
                  : 'rgba(255, 255, 255, 0.4)',
            }}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

function calloutStyle(
  spotlight: SpotlightRect | null,
  placement: ReturnType<typeof calloutPlacement>,
  panelHeight: number,
): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    left: '8%',
    right: '8%',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'left',
    pointerEvents: 'auto',
    zIndex: 51,
  };
  if (placement === 'center' || !spotlight) {
    return { ...base, top: '50%', transform: 'translateY(-50%)' };
  }
  if (placement === 'below') {
    return { ...base, top: spotlight.y + spotlight.height + CALLOUT_GAP_PX };
  }
  // above
  return {
    ...base,
    bottom: Math.max(0, panelHeight - (spotlight.y - CALLOUT_GAP_PX)),
  };
}
