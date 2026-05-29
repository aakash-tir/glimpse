// Shared layout shell for all four special-event slide types. Owns the
// title, the per-event background motion overlay, and the optional
// "Tomorrow" badge. Per-type components drop their content fields into
// `children`.
//
// The body is its own positioned ancestor so absolutely-positioned
// children fill the body region rather than the whole slide — same
// pattern as SlideShell.
//
// Background motion is rendered as an `<svg>` or absolutely-positioned
// motion overlay below the content layer. Each per-type component
// supplies its own `motionOverlay` (or none).

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const TITLE_TOP_PX = 6;
const TITLE_LINE_PX = 18;
const TITLE_AREA_PX = TITLE_TOP_PX + TITLE_LINE_PX + 6;
const BOTTOM_NAV_RESERVE_PX = 36;
// Horizontal footprint the top-right badge needs (badge width + its
// 8 px right offset). If the centred title's right edge would intrude
// into this zone, the badge drops to the bottom instead.
const BADGE_TOP_RESERVE_PX = 80;

export type EventSlideShellProps = {
  title: string;
  /** True when the event peak is calendar-tomorrow (local). */
  isTomorrow?: boolean;
  /**
   * Test-id token specific to this event slide type — e.g. `aurora`,
   * `meteor-shower`, `eclipse`, `blood-moon`. Used to scope queries
   * in component tests without colliding with the deck-level
   * `slide-event:*` testid.
   */
  testIdToken: string;
  /**
   * Background motion overlay (e.g. star field + shooting star, aurora
   * shimmer, eclipse pulse). Rendered behind the content. Optional —
   * omit for a static background.
   */
  motionOverlay?: ReactNode;
  children: ReactNode;
};

export function EventSlideShell({
  title,
  isTomorrow = false,
  testIdToken,
  motionOverlay,
  children,
}: EventSlideShellProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLSpanElement>(null);
  // Whether the centred title would collide with the top-right badge,
  // in which case the badge moves to the bottom (above the dots).
  const [badgeAtBottom, setBadgeAtBottom] = useState(false);

  useLayoutEffect(() => {
    if (!isTomorrow) return;
    const root = rootRef.current;
    const titleText = titleTextRef.current;
    if (!root || !titleText) return;
    const measure = (): void => {
      const w = root.clientWidth;
      const textW = titleText.getBoundingClientRect().width;
      // Title is centred, so its right edge is half the text width past
      // centre. The badge zone starts BADGE_TOP_RESERVE_PX from the
      // right edge; 6 px keeps a little breathing room.
      const titleRight = w / 2 + textW / 2;
      const badgeLeft = w - BADGE_TOP_RESERVE_PX;
      setBadgeAtBottom(titleRight + 6 > badgeLeft);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [isTomorrow, title]);

  return (
    <div
      ref={rootRef}
      data-testid={`event-slide-${testIdToken}`}
      data-event-tomorrow={isTomorrow ? 'on' : 'off'}
      style={{ position: 'absolute', inset: 0 }}
    >
      {motionOverlay ? (
        <div
          data-testid={`event-motion-${testIdToken}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            // Motion overlays sit behind content but inside the slide
            // bounds. Per-type components provide their own opacity
            // and animation.
            zIndex: 0,
          }}
        >
          {motionOverlay}
        </div>
      ) : null}

      <div
        data-testid="slide-title"
        data-slide-title={title}
        style={{
          position: 'absolute',
          top: TITLE_TOP_PX,
          left: 0,
          right: 0,
          height: TITLE_LINE_PX,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: 'rgba(255, 255, 255, 0.9)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <span ref={titleTextRef}>{title}</span>
      </div>

      {isTomorrow ? (
        <TomorrowBadge
          testIdToken={testIdToken}
          placement={badgeAtBottom ? 'bottom' : 'top'}
        />
      ) : null}

      <div
        data-testid="event-slide-body"
        data-bottom-reserved-px={String(BOTTOM_NAV_RESERVE_PX)}
        data-top-reserved-px={String(TITLE_AREA_PX)}
        style={{
          position: 'absolute',
          top: TITLE_AREA_PX,
          left: 0,
          right: 0,
          bottom: BOTTOM_NAV_RESERVE_PX,
          color: 'rgba(255, 255, 255, 0.92)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          padding: '0 14px',
          boxSizing: 'border-box',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Plan/slides.md: "Tomorrow plain-text badge on events whose date is
// tomorrow." Plain text per the spec — no calendar date attached, just
// the word "Tomorrow". Anchored top-right by default; when the centred
// title would overlap it (long title / narrow window) it drops to the
// bottom centre, just above the slide-count dots.
function TomorrowBadge({
  testIdToken,
  placement,
}: {
  testIdToken: string;
  placement: 'top' | 'bottom';
}): JSX.Element {
  const positionStyle: CSSProperties =
    placement === 'bottom'
      ? {
          bottom: BOTTOM_NAV_RESERVE_PX + 6,
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : { top: TITLE_TOP_PX, right: 8, height: TITLE_LINE_PX };
  return (
    <span
      data-testid={`event-tomorrow-badge-${testIdToken}`}
      data-badge-placement={placement}
      style={{
        position: 'absolute',
        ...positionStyle,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        borderRadius: 999,
        background: 'rgba(255, 255, 255, 0.14)',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      Tomorrow
    </span>
  );
}
