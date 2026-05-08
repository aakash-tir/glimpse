import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  WeatherIcon,
  HOVER_SCALE,
  CROSSFADE_DURATION_S,
} from '../../src/renderer/src/components/weather-icon';
import { conditionToGlyph, type Condition } from '../../src/shared/condition';

afterEach(() => {
  cleanup();
});

const allConditions: Condition[] = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'snow',
  'sleet',
  'thunderstorm',
];

describe('WeatherIcon — glyph mapping', () => {
  for (const condition of allConditions) {
    for (const isDay of [true, false]) {
      it(`renders the right glyph for (${condition}, ${isDay ? 'day' : 'night'})`, () => {
        render(<WeatherIcon state={{ kind: 'ready', condition, isDay }} />);
        const expected = conditionToGlyph(condition, isDay);
        const glyph = screen.getByTestId('icon-glyph');
        expect(glyph.getAttribute('data-icon-name')).toBe(expected);
      });
    }
  }
});

describe('WeatherIcon — hover scale', () => {
  it('exposes hover scale of 1.15 on the root for Framer Motion', () => {
    render(
      <WeatherIcon
        state={{ kind: 'ready', condition: 'clear', isDay: true }}
      />,
    );
    const root = screen.getByTestId('icon-root');
    expect(root.getAttribute('data-hover-scale')).toBe(String(HOVER_SCALE));
    expect(HOVER_SCALE).toBe(1.15);
  });

  it('uses a 150 ms hover duration', () => {
    render(
      <WeatherIcon
        state={{ kind: 'ready', condition: 'clear', isDay: true }}
      />,
    );
    const root = screen.getByTestId('icon-root');
    expect(root.getAttribute('data-hover-duration-s')).toBe('0.15');
  });
});

describe('WeatherIcon — loading state', () => {
  it('renders the loading cloud with the 2s sweep animation', () => {
    render(<WeatherIcon state={{ kind: 'loading' }} />);
    const loading = screen.getByTestId('icon-loading');
    expect(loading.getAttribute('data-loading-duration-ms')).toBe('2000');
    expect(screen.getByTestId('icon-loading-sweep')).toBeInTheDocument();
  });

  it('does not render the glyph in the loading state', () => {
    render(<WeatherIcon state={{ kind: 'loading' }} />);
    expect(screen.queryByTestId('icon-glyph')).not.toBeInTheDocument();
  });
});

describe('WeatherIcon — error state', () => {
  it('renders the sad cloud', () => {
    render(<WeatherIcon state={{ kind: 'error' }} />);
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-glyph')).not.toBeInTheDocument();
  });

  // Per plan/icon.md § Error state: the icon's 96×96 BrowserWindow is
  // too narrow to render the tooltip text without DWM clipping, and the
  // sad face alone is sufficient signal. The onboarding tutorial
  // previews this state instead.
  it('renders no tooltip in the error state', () => {
    render(<WeatherIcon state={{ kind: 'error' }} />);
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });
});

describe('WeatherIcon — condition cross-fade', () => {
  it('configures a 200 ms cross-fade duration on the ready element', () => {
    render(
      <WeatherIcon
        state={{ kind: 'ready', condition: 'clear', isDay: true }}
      />,
    );
    const ready = screen.getByTestId('icon-ready');
    expect(ready.getAttribute('data-glyph')).toBe('WiDaySunny');
    expect(ready.getAttribute('data-crossfade-duration-s')).toBe(
      String(CROSSFADE_DURATION_S),
    );
    expect(CROSSFADE_DURATION_S).toBe(0.2);
  });

  it('updates the rendered glyph when the condition changes', () => {
    const { rerender } = render(
      <WeatherIcon
        state={{ kind: 'ready', condition: 'clear', isDay: true }}
      />,
    );
    rerender(
      <WeatherIcon
        state={{ kind: 'ready', condition: 'cloudy', isDay: true }}
      />,
    );
    const readys = screen.getAllByTestId('icon-ready');
    const glyphs = readys.map((el) => el.getAttribute('data-glyph'));
    // During the cross-fade both old + new mount briefly. New one must be
    // present; old one may still be exiting.
    expect(glyphs).toContain('WiCloudy');
  });
});
