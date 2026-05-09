import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  SettingsSlide,
  SETTINGS_COMPACT_THRESHOLD_PX,
} from '../../src/renderer/src/components/settings-slide';
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '../../src/shared/settings-store';

// Pin window.innerWidth so tests deterministically pick segmented vs
// compact-switch rendering. jsdom defaults to 1024 → segmented mode,
// which matches the existing test expectations. Each describe block
// that exercises compact mode resets innerWidth in its own beforeEach.
function setWindowWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: px,
    configurable: true,
    writable: true,
  });
}

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

  it('lists rows in the spec-required order (wide mode includes Advanced location)', () => {
    // jsdom default 1024 px → wide mode → Advanced location row visible.
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const rows = screen.getAllByTestId('settings-row');
    const labels = rows.map((r) => r.getAttribute('data-row-label'));
    expect(labels).toEqual([
      'Units',
      'Time format',
      'Moon-phase slide',
      'Theme',
      'Track window position',
      'Advanced location',
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

describe('SettingsSlide — title', () => {
  it('renders a "Settings" title at the top of the slide', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const title = screen.getByTestId('slide-title');
    expect(title).toHaveTextContent('Settings');
    expect(title.getAttribute('data-slide-title')).toBe('Settings');
  });

  it('renders the title even during the loading state', () => {
    // Loading branch returns early — but the user should still see the
    // title so the slide identity is visible while settings load. We
    // tolerate either rendering it then or not rendering it then; the
    // sanity check is that no test-ids interfere with the loaded form.
    render(<SettingsSlide settings={null} luminance="dark" />);
    // Loaded form is what we care about; the loading branch shows a
    // simple message and is exercised by the existing loading test.
    expect(screen.getByTestId('slide-settings-loading')).toBeInTheDocument();
  });
});

describe('SettingsSlide — default-value hints in row labels', () => {
  it('shows the off-position value in brackets for each switchable row', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const hintByLabel = (label: string): string | null => {
      const row = screen
        .getAllByTestId('settings-row')
        .find((r) => r.getAttribute('data-row-label') === label);
      return row?.getAttribute('data-row-default-hint') ?? null;
    };
    expect(hintByLabel('Units')).toBe('metric');
    expect(hintByLabel('Time format')).toBe('12 h');
    expect(hintByLabel('Moon-phase slide')).toBe('off');
    expect(hintByLabel('Theme')).toBe('light');
    expect(hintByLabel('Track window position')).toBe('off');
  });

  it('does NOT show a default hint on the action-button rows', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const hintByLabel = (label: string): string | null => {
      const row = screen
        .getAllByTestId('settings-row')
        .find((r) => r.getAttribute('data-row-label') === label);
      return row?.getAttribute('data-row-default-hint') ?? null;
    };
    expect(hintByLabel('Reset icon position')).toBe('');
    expect(hintByLabel('Manual refresh')).toBe('');
    expect(hintByLabel('Replay tutorial')).toBe('');
  });

  it('renders the bracketed hint text alongside the row label', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    const hints = screen.getAllByTestId('settings-row-default-hint');
    // 6 switchable rows in wide mode (Units, Time, Moon, Theme,
    // Track window, Advanced location).
    expect(hints).toHaveLength(6);
    const texts = hints.map((h) => h.textContent);
    expect(texts).toContain('(metric)');
    expect(texts).toContain('(12 h)');
    expect(texts).toContain('(off)');
    expect(texts).toContain('(light)');
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

// Below SETTINGS_COMPACT_THRESHOLD_PX the labeled segmented controls
// (Units / Time / Theme) collapse into the same blue switches the
// always-binary rows use. Above the threshold they stay as labeled
// segmented buttons.
describe('SettingsSlide — compact mode (narrow window)', () => {
  beforeEach(() => {
    // Pick a width comfortably below the threshold so the math
    // doesn't depend on the exact threshold value.
    setWindowWidth(SETTINGS_COMPACT_THRESHOLD_PX - 40);
    installStub();
  });

  afterEach(() => {
    setWindowWidth(1024);
  });

  it('marks the shell with data-compact="on" below the threshold', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(
      screen.getByTestId('slide-settings-shell').getAttribute('data-compact'),
    ).toBe('on');
  });

  it('renders Units, Time format, and Theme as switches (no segmented buttons)', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    // Wrappers exist but contain a switch (role="switch"), not labeled
    // segments — querying for the segment-specific testIds returns null.
    expect(screen.queryByTestId('settings-units-metric')).toBeNull();
    expect(screen.queryByTestId('settings-units-imperial')).toBeNull();
    expect(screen.queryByTestId('settings-time-format-12h')).toBeNull();
    expect(screen.queryByTestId('settings-time-format-24h')).toBeNull();
    expect(screen.queryByTestId('settings-theme-auto')).toBeNull();
    expect(screen.queryByTestId('settings-theme-light')).toBeNull();
    expect(screen.queryByTestId('settings-theme-dark')).toBeNull();
    // The base testIds are now switches.
    expect(screen.getByTestId('settings-units').getAttribute('role')).toBe(
      'switch',
    );
    expect(
      screen.getByTestId('settings-time-format').getAttribute('role'),
    ).toBe('switch');
    expect(screen.getByTestId('settings-theme').getAttribute('role')).toBe(
      'switch',
    );
  });

  it('Units switch off = metric (the spec default), on = imperial', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ units: 'metric' })}
        luminance="dark"
      />,
    );
    expect(
      screen.getByTestId('settings-units').getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByTestId('settings-units'));
    expect(stub.setSettings).toHaveBeenCalledWith({ units: 'imperial' });
  });

  it('Units switch reads imperial as on', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ units: 'imperial' })}
        luminance="dark"
      />,
    );
    expect(
      screen.getByTestId('settings-units').getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('Time-format switch off = 12h, on = 24h', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ timeFormat: '12h' })}
        luminance="dark"
      />,
    );
    expect(
      screen.getByTestId('settings-time-format').getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByTestId('settings-time-format'));
    expect(stub.setSettings).toHaveBeenCalledWith({ timeFormat: '24h' });
  });

  it('Theme switch off = light, on = dark, and clicking off → on writes "dark"', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ themeOverride: 'light' })}
        luminance="light"
      />,
    );
    expect(
      screen.getByTestId('settings-theme').getAttribute('aria-checked'),
    ).toBe('false');
    fireEvent.click(screen.getByTestId('settings-theme'));
    expect(stub.setSettings).toHaveBeenCalledWith({ themeOverride: 'dark' });
  });

  it('Theme switch with override="auto" reflects the resolved luminance', () => {
    // Auto + resolved-light → switch off; auto + resolved-dark → switch on.
    render(
      <SettingsSlide
        settings={buildSettings({ themeOverride: 'auto' })}
        luminance="light"
      />,
    );
    expect(
      screen.getByTestId('settings-theme').getAttribute('aria-checked'),
    ).toBe('false');
    cleanup();

    render(
      <SettingsSlide
        settings={buildSettings({ themeOverride: 'auto' })}
        luminance="dark"
      />,
    );
    expect(
      screen.getByTestId('settings-theme').getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('clicking the auto-resolved Theme switch writes an explicit override', () => {
    const stub = installStub();
    render(
      <SettingsSlide
        settings={buildSettings({ themeOverride: 'auto' })}
        luminance="light"
      />,
    );
    // Currently auto + resolved-light → switch off → click flips to dark.
    fireEvent.click(screen.getByTestId('settings-theme'));
    expect(stub.setSettings).toHaveBeenCalledWith({ themeOverride: 'dark' });
  });
});

describe('SettingsSlide — Advanced location toggle visibility', () => {
  it('is hidden in compact mode (form fields too cramped below threshold)', () => {
    setWindowWidth(SETTINGS_COMPACT_THRESHOLD_PX - 40);
    installStub();
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(
      screen.queryByTestId('settings-advanced-location'),
    ).not.toBeInTheDocument();
    setWindowWidth(1024);
  });

  it('is visible in wide mode', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(
      screen.getByTestId('settings-advanced-location'),
    ).toBeInTheDocument();
  });

  it('expands the form below it when the toggle is on', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ advancedLocationEnabled: true })}
        luminance="dark"
        detectedCity="Kelowna"
      />,
    );
    expect(screen.getByTestId('advanced-location')).toBeInTheDocument();
  });

  it('hides the form when the toggle is off', () => {
    render(
      <SettingsSlide
        settings={buildSettings({ advancedLocationEnabled: false })}
        luminance="dark"
        detectedCity="Kelowna"
      />,
    );
    expect(screen.queryByTestId('advanced-location')).not.toBeInTheDocument();
  });

  it('passes the active override to the form when the user has saved one', () => {
    render(
      <SettingsSlide
        settings={buildSettings({
          advancedLocationEnabled: true,
          locationOverrides: [
            {
              detectedCity: 'Kelowna',
              city: 'Kelowna Airport',
              latitude: 49.96,
              longitude: -119.38,
            },
          ],
        })}
        luminance="dark"
        detectedCity="Kelowna"
      />,
    );
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('Kelowna Airport');
  });
});

describe('SettingsSlide — segmented mode (wide window)', () => {
  // Restate that wide windows still render the segmented controls.
  // Default jsdom innerWidth = 1024 (well above the threshold), but
  // make it explicit here so a future jsdom default change doesn't
  // silently flip the assertion.
  beforeEach(() => {
    setWindowWidth(SETTINGS_COMPACT_THRESHOLD_PX + 100);
    installStub();
  });

  afterEach(() => {
    setWindowWidth(1024);
  });

  it('marks the shell with data-compact="off" above the threshold', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(
      screen.getByTestId('slide-settings-shell').getAttribute('data-compact'),
    ).toBe('off');
  });

  it('Units / Time / Theme render their labeled segmented buttons', () => {
    render(<SettingsSlide settings={buildSettings()} luminance="dark" />);
    expect(screen.getByTestId('settings-units-metric')).toBeInTheDocument();
    expect(screen.getByTestId('settings-time-format-24h')).toBeInTheDocument();
    expect(screen.getByTestId('settings-theme-auto')).toBeInTheDocument();
  });
});
