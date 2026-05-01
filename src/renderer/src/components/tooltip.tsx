import { useEffect, useRef, useState, type ReactNode } from 'react';

const HOVER_DELAY_MS = 200;

const baseStyle: React.CSSProperties = {
  position: 'fixed',
  background: 'rgba(20, 20, 30, 0.85)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 8,
  color: 'white',
  fontSize: 12,
  lineHeight: 1.2,
  padding: '4px 8px',
  pointerEvents: 'none',
  zIndex: 1000,
  whiteSpace: 'nowrap',
};

// Custom dark-glass tooltip per plan/styling.md.
// 200ms hover delay before show, no native browser tooltip.
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}): JSX.Element {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function show(): void {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        // Anchor the tooltip's right edge to the target's right edge so
        // it stays inside the icon window when the icon sits in the
        // top-right corner. Tooltip sits flush against the icon's
        // bottom (no gap).
        setPos({ x: rect.right, y: rect.bottom });
      }
      setVisible(true);
    }, HOVER_DELAY_MS);
  }

  function hide(): void {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  }

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {visible && pos && (
        <div
          role="tooltip"
          data-testid="tooltip"
          data-tooltip-delay-ms={HOVER_DELAY_MS}
          style={{
            ...baseStyle,
            left: pos.x,
            top: pos.y,
            transform: 'translateX(-100%)',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}
