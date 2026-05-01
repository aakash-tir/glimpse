import { WeatherIcon } from './components/weather-icon';
import { ICON_OFFSET_X, ICON_OFFSET_Y } from '../../shared/icon-position';

export function App(): JSX.Element {
  return (
    <div
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
      >
        <WeatherIcon
          state={{ kind: 'ready', condition: 'clear', isDay: true }}
        />
      </div>
    </div>
  );
}
