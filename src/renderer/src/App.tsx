import { WeatherIcon } from './components/weather-icon';

export function App(): JSX.Element {
  return (
    <div
      style={
        {
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties
      }
    >
      <WeatherIcon state={{ kind: 'ready', condition: 'clear', isDay: true }} />
    </div>
  );
}
