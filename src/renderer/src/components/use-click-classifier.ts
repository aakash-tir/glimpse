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

export type ClickClassifier = {
  click: () => void;
  // Cancels any pending single-click timer scheduled by a recent click.
  // Use this when the surrounding state changes such that a previously-
  // recorded click is no longer relevant — e.g. drag mode exits via an
  // off-icon click, and we don't want a pending on-icon click's timer
  // to fire onSingleClick after dragMode has flipped to false.
  cancelPending: () => void;
};

// Returns an object with a `click` event handler that fires
// `onSingleClick` after the threshold elapses with no second click, or
// `onDoubleClick` immediately when a second click arrives within the
// threshold. Plus a `cancelPending` escape hatch for callers that need
// to discard a queued click in response to an external state change.
export function useClickClassifier({
  onSingleClick,
  onDoubleClick,
  thresholdMs = DOUBLE_CLICK_THRESHOLD_MS,
}: ClickClassifierOptions): ClickClassifier {
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

  const cancelPending = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    lastClickRef.current = null;
  }, []);

  const click = useCallback(() => {
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

  return { click, cancelPending };
}
