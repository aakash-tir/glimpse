import { useCallback, useEffect, useState } from 'react';
import { WeatherIcon } from './components/weather-icon';
import { useClickClassifier } from './components/use-click-classifier';
import { ICON_OFFSET_X, ICON_OFFSET_Y } from '../../shared/icon-position';

export function App(): JSX.Element {
  const [dragMode, setDragMode] = useState(false);

  const handleSingleClick = useCallback(() => {
    // M3 will wire single-click to expand the icon into the window. For M2
    // it is a no-op in both states (the spec already requires it to be
    // ignored while drag mode is active).
  }, []);

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

  return (
    <div
      data-testid="app-root"
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
      >
        <WeatherIcon
          state={{ kind: 'ready', condition: 'clear', isDay: true }}
          dragMode={dragMode}
        />
      </div>
    </div>
  );
}
