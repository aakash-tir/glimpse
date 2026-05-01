import { useCallback, useEffect, useRef } from 'react';
import {
  DOUBLE_CLICK_THRESHOLD_MS,
  isDoubleClick,
} from '../../../shared/click-classifier';

type ClickClassifierOptions = {
  onSingleClick: () => void;
  onDoubleClick: () => void;
  thresholdMs?: number;
};

// Returns a `click` event handler that fires `onSingleClick` after the
// threshold elapses with no second click, or `onDoubleClick` immediately
// when a second click arrives within the threshold. The pending
// single-click is cancelled in the double-click case so it never fires.
export function useClickClassifier({
  onSingleClick,
  onDoubleClick,
  thresholdMs = DOUBLE_CLICK_THRESHOLD_MS,
}: ClickClassifierOptions): () => void {
  const lastClickRef = useRef<number | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always fire the latest callbacks, without re-binding the click handler
  // on every render.
  const onSingleClickRef = useRef(onSingleClick);
  const onDoubleClickRef = useRef(onDoubleClick);
  onSingleClickRef.current = onSingleClick;
  onDoubleClickRef.current = onDoubleClick;

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  return useCallback(() => {
    const now = performance.now();
    const prev = lastClickRef.current;
    if (isDoubleClick(prev, now, thresholdMs)) {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      lastClickRef.current = null;
      onDoubleClickRef.current();
      return;
    }
    lastClickRef.current = now;
    pendingTimerRef.current = setTimeout(() => {
      lastClickRef.current = null;
      pendingTimerRef.current = null;
      onSingleClickRef.current();
    }, thresholdMs);
  }, [thresholdMs]);
}
