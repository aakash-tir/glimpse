import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { WeatherIcon, type IconState } from '../components/weather-icon';
import { useClickClassifier } from '../components/use-click-classifier';
import { useDataSnapshot } from '../components/use-data-snapshot';
import type { DataSnapshot } from '../../../shared/data-snapshot';

// Maps the data store's snapshot to the icon's visual state.
//   null              → loading (haven't received the first snapshot yet)
//   errorState=error  → sad cloud + error tooltip
//   forecast=null     → loading (snapshot received but no successful
//                       fetch yet; same visual as the pre-snapshot gap)
//   otherwise         → ready, with the current condition.
//
// isDay is hard-coded to true here — proper sunrise/sunset comparison
// is M6 scope (see rules/testing.md § M6).
function snapshotToIconState(snapshot: DataSnapshot | null): IconState {
  if (snapshot === null) return { kind: 'loading' };
  if (snapshot.errorState === 'error') return { kind: 'error' };
  if (snapshot.forecast === null) return { kind: 'loading' };
  return {
    kind: 'ready',
    condition: snapshot.forecast.current.condition,
    isDay: true,
  };
}

// IconView — the collapsed, icon-mode renderer. Owns its own drag-mode
// state and the icon's click handlers. Single-click asks main to
// expand to window mode; double-click toggles drag mode.
export function IconView(): JSX.Element {
  const snapshot = useDataSnapshot();
  const iconState = useMemo(() => snapshotToIconState(snapshot), [snapshot]);
  const [dragMode, setDragMode] = useState(false);
  // Latched when the click classifier commits a single-click that
  // triggers expand. Snap-hides the glyph and gates the deferred
  // expand IPC (see handleSingleClick for the timing rationale).
  const [expanding, setExpanding] = useState(false);
  const isDraggingRef = useRef(false);

  const handleSingleClick = useCallback(() => {
    // Single-click only expands when not in drag mode (drag mode swallows
    // single clicks per plan/icon.md). Also gated on `expanding` so a
    // stray click during the deferred IPC doesn't fire a second expand.
    // Also ignored in the error state: window mode would just show
    // skeleton placeholders behind a sad-cloud icon, which is more
    // confusing than helpful — see plan/icon.md § Error state. The
    // onboarding tutorial previews this state so the user isn't
    // surprised when they hit it.
    if (dragMode || expanding || iconState.kind === 'error') return;
    // flushSync forces React to commit the `expanding=true` update to
    // the DOM synchronously before this function returns. Without it,
    // the commit lands in a microtask after the click handler — the
    // first rAF below could in principle run before the commit on a
    // bad scheduling tick. flushSync removes that variable from the
    // race so the rAF chain is purely waiting on the paint pipeline.
    flushSync(() => {
      setExpanding(true);
    });
    // Defer the expand IPC long enough for the entire render pipeline
    // to publish the glyph-hidden frame to the OS swap chain BEFORE
    // main resizes the BrowserWindow. The pipeline is:
    //
    //   React commit  →  paint (renderer)
    //                 →  composite (GPU process)
    //                 →  swap chain present (OS / DXGI)
    //                 →  DWM displays at next vsync
    //
    // Two RAFs only covers the paint step. The GPU → swap-chain →
    // DWM legs run on separate processes/threads; under load or just
    // unlucky vsync alignment they can still be showing the frame
    // BEFORE setExpanding when the IPC arrives in main. main calls
    // iconWindow.setBounds(<window-mode bounds>) synchronously, and
    // DWM uses whatever surface the swap chain holds at that instant
    // as the source for the resize — so a stale frame produces the
    // glyph-at-top-left flash.
    //
    // Three RAFs (~48 ms) gives the GPU composite + swap chain
    // present a full extra frame to catch up. This empirically
    // eliminates the residual flash that two RAFs leaves on busy /
    // hardware-accelerated machines. The added ~16 ms is below
    // perceptual threshold on top of the click classifier's existing
    // 250 ms double-click wait.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void window.glimpse?.expand();
        });
      });
    });
  }, [dragMode, expanding, iconState.kind]);

  const handleDoubleClick = useCallback(() => {
    setDragMode((on) => !on);
  }, []);

  const { click: handleIconClick, cancelPending: cancelPendingClick } =
    useClickClassifier({
      onSingleClick: handleSingleClick,
      onDoubleClick: handleDoubleClick,
    });

  // Window blur (focus moved to another app or the desktop) exits drag
  // mode — the user has effectively "clicked outside" the icon. Same
  // pending-click cancellation as handleOutsideClick: a queued click
  // recorded while in drag mode shouldn't fire onSingleClick after the
  // blur flips dragMode to false.
  useEffect(() => {
    if (!dragMode) return;
    const onBlur = (): void => {
      setDragMode(false);
      cancelPendingClick();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [dragMode, cancelPendingClick]);

  // Mousemove + mouseup are bound at the window level so a fast cursor
  // that briefly outpaces the moving icon window doesn't drop the drag
  // mid-gesture.
  useEffect(() => {
    if (!dragMode) return;
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      window.glimpse?.dragMove({ x: e.screenX, y: e.screenY });
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      window.glimpse?.dragEnd({ x: e.screenX, y: e.screenY });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragMode]);

  // Click on the transparent area of the icon window (anywhere outside the
  // 64x64 glyph) also exits drag mode. The icon's own click handler stops
  // propagation, so this listener only fires for off-icon clicks.
  //
  // Also cancels any pending click queued in the click classifier — see
  // the bug where clicking on the icon while in drag mode (which queues
  // a 250 ms single-click timer) and then clicking off-icon (which exits
  // drag mode) would let the queued timer fire after dragMode flipped to
  // false, mistakenly triggering expand(). The cancel ensures the queued
  // click is discarded along with the drag-mode exit.
  const handleOutsideClick = useCallback(() => {
    if (!dragMode) return;
    setDragMode(false);
    cancelPendingClick();
  }, [dragMode, cancelPendingClick]);

  const handleIconClickWithStop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      handleIconClick();
    },
    [handleIconClick],
  );

  const handleIconMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragMode) return;
      e.preventDefault();
      isDraggingRef.current = true;
      window.glimpse?.dragStart({ x: e.screenX, y: e.screenY });
    },
    [dragMode],
  );

  return (
    <div
      data-testid="icon-view"
      data-drag-mode={dragMode ? 'on' : 'off'}
      data-expanding={expanding ? 'on' : 'off'}
      onClick={handleOutsideClick}
      style={
        {
          width: '100vw',
          height: '100vh',
          background: 'transparent',
          position: 'relative',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      {/* The glyph is snap-hidden via visibility:hidden the moment
          the user single-clicks to expand, so the next paint
          contains no glyph pixels. Combined with the double-RAF
          defer in handleSingleClick, this guarantees the OS resizes
          the BrowserWindow against a framebuffer that no longer
          contains the glyph — eliminating the flash at the new
          window's top-left.

          visibility:hidden (rather than unmounting / display:none)
          keeps the element in the DOM so test queries against
          icon-root remain valid through the brief expanding window,
          and so a queued single-click whose subsequent click event
          arrives between setExpanding(true) and the IPC firing
          still hits a real element (the gate in handleSingleClick
          short-circuits the second expand). */}
      <div
        style={{
          position: 'absolute',
          // Anchor the glyph to the WINDOW CENTER. In icon mode
          // (96 × 96) this resolves to (48, 48) — equal to
          // ICON_PADDING + ICON_SIZE / 2 — so the visual position
          // is identical to the previous top-left + 64 × 64
          // anchoring.
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          visibility: expanding ? 'hidden' : 'visible',
        }}
        onClick={handleIconClickWithStop}
        onMouseDown={handleIconMouseDown}
      >
        <WeatherIcon state={iconState} dragMode={dragMode} />
      </div>
    </div>
  );
}
