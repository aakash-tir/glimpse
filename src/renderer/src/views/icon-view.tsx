import { useCallback, useEffect, useRef, useState } from 'react';
import { WeatherIcon } from '../components/weather-icon';
import { useClickClassifier } from '../components/use-click-classifier';
import { ICON_OFFSET_X, ICON_OFFSET_Y } from '../../../shared/icon-position';

// IconView — the collapsed, icon-mode renderer. Owns its own drag-mode
// state and the icon's click handlers. Single-click asks main to
// expand to window mode; double-click toggles drag mode.
export function IconView(): JSX.Element {
  const [dragMode, setDragMode] = useState(false);
  const isDraggingRef = useRef(false);

  const handleSingleClick = useCallback(() => {
    // Single-click only expands when not in drag mode (drag mode swallows
    // single clicks per plan/icon.md).
    if (dragMode) return;
    void window.glimpse?.expand();
  }, [dragMode]);

  const handleDoubleClick = useCallback(() => {
    setDragMode((on) => !on);
  }, []);

  const handleIconClick = useClickClassifier({
    onSingleClick: handleSingleClick,
    onDoubleClick: handleDoubleClick,
  });

  // Window blur (focus moved to another app or the desktop) exits drag
  // mode — the user has effectively "clicked outside" the icon.
  useEffect(() => {
    if (!dragMode) return;
    const onBlur = (): void => setDragMode(false);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [dragMode]);

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
  const handleOutsideClick = useCallback(() => {
    if (dragMode) setDragMode(false);
  }, [dragMode]);

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
