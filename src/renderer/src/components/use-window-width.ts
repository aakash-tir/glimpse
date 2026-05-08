import { useEffect, useState } from 'react';

// Subscribes to `window.innerWidth` so callers re-render when the
// Electron window is resized. Used by the M6 hourly + 7-day slides to
// pick a responsive visible-cell count without mounting a per-slide
// ResizeObserver — both slides span the full window, so the window's
// inner width is exactly the slide width.
//
// Returns the current `window.innerWidth`. SSR / test harnesses where
// `window` is undefined fall back to a sensible default so the first
// render matches the default Electron window size.
export const DEFAULT_WINDOW_INNER_WIDTH_PX = 240;

export function useWindowInnerWidth(): number {
  const [width, setWidth] = useState(() => readInnerWidth());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

function readInnerWidth(): number {
  if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') {
    return DEFAULT_WINDOW_INNER_WIDTH_PX;
  }
  return window.innerWidth;
}
