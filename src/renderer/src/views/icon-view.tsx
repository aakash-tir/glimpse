import { useCallback, useEffect, useRef, useState } from 'react';
import { WeatherIcon } from '../components/weather-icon';
import { useClickClassifier } from '../components/use-click-classifier';
import { ICON_OFFSET_X, ICON_OFFSET_Y } from '../../../shared/icon-position';

// IconView — the collapsed, icon-mode renderer. Owns its own drag-mode
// state and the icon's click handlers. Single-click asks main to
// expand to window mode; double-click toggles drag mode.
export function IconView(): JSX.Element {
  const [dragMode, setDragMode] = useState(false);
  // Latched the moment the click classifier commits a single-click that
  // triggers expand. The icon glyph is then hidden via `visibility:
  // hidden` (kept mounted in the DOM so existing tests can still query
  // it by testid) so the renderer doesn't paint the glyph at its (16,
  // 16) icon-mode offset in the freshly-resized window — that paint
  // showed up as a one-frame flash of the icon at the new window's
  // top-left corner. The earlier resize-event-listener fix was racy
  // because the renderer can paint between the OS resizing the window
  // and the resize event causing a React re-render; setting state
  // synchronously inside the click handler guarantees the glyph is
  // hidden before the IPC even reaches main.
  const [expanding, setExpanding] = useState(false);
  const isDraggingRef = useRef(false);

  const handleSingleClick = useCallback(() => {
    // Single-click only expands when not in drag mode (drag mode swallows
    // single clicks per plan/icon.md).
    if (dragMode) return;
    setExpanding(true);
    void window.glimpse?.expand();
  }, [dragMode]);

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
      <div
        style={{
          position: 'absolute',
          left: ICON_OFFSET_X,
          top: ICON_OFFSET_Y,
          // visibility (not display:none / conditional render) keeps the
          // glyph + its testid in the DOM so existing tests can still
          // query icon-root after a single-click commits expand. The
          // visual hide is what prevents the one-frame flash of the
          // glyph at the resized window's top-left.
          visibility: expanding ? 'hidden' : 'visible',
        }}
        onClick={handleIconClickWithStop}
        onMouseDown={handleIconMouseDown}
      >
        <WeatherIcon
          state={{ kind: 'ready', condition: 'clear', isDay: true }}
          dragMode={dragMode}
        />
      </div>
    </div>
  );
}
