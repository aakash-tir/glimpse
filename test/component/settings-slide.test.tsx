import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsSlide } from '../../src/renderer/src/components/settings-slide';
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '../../src/shared/settings-store';

type GlimpseStub = {
  setSettings: ReturnType<typeof vi.fn>;
  resetIconPosition: ReturnType<typeof vi.fn>;
  refreshData: ReturnType<typeof vi.fn>;
};

function installStub(): GlimpseStub {
  const stub: GlimpseStub = {
    setSettings: vi.fn().mockResolvedValue(undefined),
    resetIconPosition: vi.fn().mockResolvedValue(undefined),
    refreshData: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { glimpse: GlimpseStub }).glimpse = stub;
  return stub;
}

beforeEach(() => {
  installStub();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { glimpse?: unknown }).glimpse;
});

function buildSettings(overrides?: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('SettingsSlide — loading', () => {
  it('renders a loading message when settings are null', () => {
    render(<SettingsSlide settings={null} luminance="dark" />);
    expect(screen.getByTestId('slide-settings-loading')).toBeInTheDocument();
    expect(
      screen.queryByTestId('slide-settings-content'),
    ).not.toBeInTheDocument();
  });
});

describe('SettingsSlide — control reads', () => {
  it('reflects every settings value on the corresponding control', () => {
    render(
      <SettingsSlide
        settings={buildSettings({
          units: 'imperial',
          timeFormat: '12h',
          moonPhaseSlideEnabled: true,
          themeOverride: 'dark',
          trackWindowPosition: true,
        })}
        luminance="dark"
      />,
    );
    expect(
      screen.getByTestId('settings-units').getAttribute('data-current-value'),
    ).toBe('imperial');
    expect(
      screen
        .getByTestId('settings-time-format')
        .getAttribute('data-current-value'),
    ).toBe('12h');
    // Moon-phase + track-window are switches now (binary on/off, no
    // word labels) — assert via aria-checked / data-checked.
    const moon = screen.getByTestId('settings-moon-toggle');
    expect(moon.getAttribute('aria-checked')).toBe('true');
    expect(moon.getAttribute('data-checked')).toBe('on');
    expect(
      screen.getByTestId('settings-theme').getAttribute('data-current-value'),
    ).toBe('dark');
    const trackWindow = screen.getByTestId('settings-track-window');
    expect(trackWindow.getAttribute('aria-checked')).toBe('true');
    expect(trackWindow.getAttribute('data-checked')).toBe('on');
  });

  it('lists rows in the spec-required order', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const rows = screen.getAllByTestId('settings-row');
    const labels = rows.map((r) => r.getAttribute('data-row-label'));
    expect(labels).toEqual([
      'Units',
      'Time format',
      'Moon-phase slide',
      'Theme',
      'Track window position',
      'Reset icon position',
      'Manual refresh',
      'Replay tutorial',
    ]);
  });

  it('renders the About section with the credits line', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const about = screen.getByTestId('settings-about');
    expect(about.textContent).toContain('Glimpse');
    expect(about.textContent).toContain('Open-Meteo');
    expect(about.textContent).toContain('NOAA SWPC');
    expect(about.textContent).toContain('SunCalc');
  });
});

describe('SettingsSlide — control writes', () => {
  it('clicking the inactive Units segment writes back via setSettings', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    fireEvent.click(screen.getByTestId('settings-units-imperial'));
    expect(stub.setSettings).toHaveBeenCalledWith({ units: 'imperial' });
  });

  it('clicking the active segment is a no-op (does not redundantly write)', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ units: 'metric' })}
        luminance="dark"
      />,
    );
    fireEvent.click(screen.getByTestId('settings-units-metric'));
    expect(stub.setSettings).not.toHaveBeenCalled();
  });

  it('writes timeFormat on segment click', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    fireEvent.click(screen.getByTestId('settings-time-format-12h'));
    expect(stub.setSettings).toHaveBeenCalledWith({ timeFormat: '12h' });
  });

  it('clicking the moon-phase switch (off → on) writes true', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    // Default is off; one click flips to on.
    fireEvent.click(screen.getByTestId('settings-moon-toggle'));
    expect(stub.setSettings).toHaveBeenCalledWith({
      moonPhaseSlideEnabled: true,
    });
  });

  it('clicking the moon-phase switch (on → off) writes false', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: true })}
        luminance="dark"
      />,
    );
    fireEvent.click(screen.getByTestId('settings-moon-toggle'));
    expect(stub.setSettings).toHaveBeenCalledWith({
      moonPhaseSlideEnabled: false,
    });
  });

  it('writes themeOverride for each of auto/light/dark', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ themeOverride: 'auto' })}
        luminance="dark"
      />,
    );
    fireEvent.click(screen.getByTestId('settings-theme-light'));
    fireEvent.click(screen.getByTestId('settings-theme-dark'));
    expect(stub.setSettings).toHaveBeenCalledWith({ themeOverride: 'light' });
    expect(stub.setSettings).toHaveBeenCalledWith({ themeOverride: 'dark' });
  });

  it('clicking the track-window switch (off → on) writes true', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    fireEvent.click(screen.getByTestId('settings-track-window'));
    expect(stub.setSettings).toHaveBeenCalledWith({
      trackWindowPosition: true,
    });
  });

  it('Reset icon position calls resetIconPosition (not setSettings)', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    fireEvent.click(screen.getByTestId('settings-reset-icon'));
    expect(stub.resetIconPosition).toHaveBeenCalledOnce();
    expect(stub.setSettings).not.toHaveBeenCalled();
  });

  it('Manual refresh calls refreshData', () => {
    const stub = installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    fireEvent.click(screen.getByTestId('settings-manual-refresh'));
    expect(stub.refreshData).toHaveBeenCalledOnce();
  });

  it('Replay tutorial button is rendered but disabled (M9 wires the actual flow)', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const replay = screen.getByTestId(
      'settings-replay-tutorial',
    ) as HTMLButtonElement;
    expect(replay.disabled).toBe(true);
    expect(replay.getAttribute('data-disabled')).toBe('on');
  });
});

describe('SettingsSlide — binary switch styling', () => {
  it('switch track is blue when checked, neutral when unchecked', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: false })}
        luminance="dark"
      />,
    );
    const switchOff = screen.getByTestId(
      'settings-moon-toggle',
    ) as HTMLButtonElement;
    // Off track is the neutral white-22% on dark backgrounds — colors
    // are normalized by the browser engine, just assert it isn't blue.
    expect(switchOff.style.backgroundColor).not.toBe('rgb(59, 130, 246)');

    cleanup();

    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: true })}
        luminance="dark"
      />,
    );
    const switchOn = screen.getByTestId(
      'settings-moon-toggle',
    ) as HTMLButtonElement;
    // #3b82f6 normalises to rgb(59, 130, 246) in jsdom.
    expect(switchOn.style.backgroundColor).toBe('rgb(59, 130, 246)');
  });

  it('switch thumb slides from left (off) to right (on)', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: false })}
        luminance="dark"
      />,
    );
    const offThumb = screen.getByTestId('settings-moon-toggle-thumb');
    const offLeft = parseInt(offThumb.style.left, 10);
    cleanup();

    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: true })}
        luminance="dark"
      />,
    );
    const onThumb = screen.getByTestId('settings-moon-toggle-thumb');
    const onLeft = parseInt(onThumb.style.left, 10);

    expect(onLeft).toBeGreaterThan(offLeft);
  });

  it('switch exposes role="switch" and aria-checked for accessibility', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ moonPhaseSlideEnabled: true })}
        luminance="dark"
      />,
    );
    const sw = screen.getByRole('switch', { name: 'Moon-phase slide' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});

describe('SettingsSlide — luminance palette', () => {
  it('exposes the active luminance via data attribute (dark)', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(
      screen.getByTestId('slide-settings-shell').getAttribute('data-luminance'),
    ).toBe('dark');
  });

  it('exposes the active luminance via data attribute (light)', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="light" />);
    expect(
      screen.getByTestId('slide-settings-shell').getAttribute('data-luminance'),
    ).toBe('light');
  });
});
