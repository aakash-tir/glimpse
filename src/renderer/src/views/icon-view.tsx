import { useCallback, useEffect, useRef, useState } from 'react';
import { WeatherIcon } from '../components/weather-icon';
import { useClickClassifier } from '../components/use-click-classifier';
import { ICON_OFFSET_X, ICON_OFFSET_Y } from '../../../shared/icon-position';

// IconView — the collapsed, icon-mode renderer. Owns its own drag-mode
// state and the icon's click handlers. Single-click asks main to
// expand to window mode; double-click toggles drag mode.
// Width/height threshold above which we treat the BrowserWindow as
// "resized for window mode" — the icon-mode window is 96 × 96 (see
// WINDOW_WIDTH / WINDOW_HEIGHT in icon-position.ts). Anything materially
// larger means main has already begun the icon → window expand and we
// should stop painting the icon glyph at its icon-mode offset.
const ICON_MODE_MAX_SIDE_PX = 100;

export function IconView(): JSX.Element {
  const [dragMode, setDragMode] = useState(false);
  // Tracks whether the BrowserWindow has been resized past icon-mode
  // dimensions. Set true the moment main calls setBounds(window-mode
  // bounds), which fires a window `resize` event in the renderer. Used
  // to hide the icon glyph for the brief interval between (a) main
  // resizing the BrowserWindow and (b) the renderer receiving
  // `mode:changed` and swapping in WindowView. Without this, the
  // renderer paints one frame of the glyph at its (16, 16) icon-mode
  // offset inside the freshly-resized larger window — visually a flash
  // at the new window's top-left corner.
  const [windowResized, setWindowResized] = useState(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const onResize = (): void => {
      if (
        window.innerWidth > ICON_MODE_MAX_SIDE_PX ||
        window.innerHeight > ICON_MODE_MAX_SIDE_PX
      ) {
        setWindowResized(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      data-window-resized={windowResized ? 'on' : 'off'}
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
      {windowResized ? null : (
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
      )}
    </div>
  );
}
