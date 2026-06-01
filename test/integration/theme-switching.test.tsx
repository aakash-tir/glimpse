// Integration test for the M7 live theme-switching flow:
//
//   nativeTheme.on('updated')  →  ipcMain send 'theme:changed'
//                              →  preload onThemeChanged
//                              →  useResolvedTheme()
//                              →  SlideDeck themeMode prop
//                              →  Settings slide background fade
//
// We can't drive the real Electron nativeTheme from a renderer test, so
// we mount the WindowView with a stubbed glimpse bridge whose
// onThemeChanged exposes its callback. Calling that callback simulates
// a main-process push (whether it originated from nativeTheme.updated
// or from a settings:set with themeOverride change is irrelevant — the
// renderer treats all of them the same).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { WindowView } from '../../src/renderer/src/views/window-view';
import { THEME_TRANSITION_DURATION_S } from '../../src/renderer/src/components/slide-deck';
import type { Settings } from '../../src/shared/settings-store';
import type { ResolvedTheme } from '../../src/shared/theme';
import type { DataSnapshot } from '../../src/shared/data-snapshot';

const SETTINGS: Settings = {
  units: 'metric',
  timeFormat: '24h',
  iconPosition: null,
  moonPhaseSlideEnabled: false,
  themeOverride: 'auto',
  trackWindowPosition: false,
  windowBounds: null,
  onboardingCompleted: false,
  advancedLocationEnabled: false,
  locationOverrides: [],
  browserGeolocation: null,
  locationPermissionAsked: false,
  cachedLocation: null,
};

const SNAPSHOT: DataSnapshot = {
  location: null,
  detectedCity: null,
  forecast: null,
  kp: null,
  lastUpdated: null,
  errorState: 'ok',
  eventsHidden: false,
  auroraVisibleFromUserLocation: false,
};

type ThemeListener = (theme: ResolvedTheme) => void;

function installStub(initialTheme: ResolvedTheme = 'dark'): {
  pushTheme: (t: ResolvedTheme) => void;
} {
  const themeListeners: ThemeListener[] = [];
  const stub = {
    dragStart: vi.fn(),
    dragMove: vi.fn(),
    dragEnd: vi.fn(),
    collapse: vi.fn(),
    previewCollapseAnchor: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    quit: vi.fn(),
    getMode: vi.fn().mockResolvedValue('window'),
    expand: vi.fn(),
    onModeChanged: vi.fn().mockReturnValue(() => {}),
    resizeStart: vi.fn(),
    resizeMove: vi.fn(),
    resizeEnd: vi.fn(),
    getSettings: vi.fn().mockResolvedValue(SETTINGS),
    setSettings: vi.fn().mockResolvedValue(SETTINGS),
    resetIconPosition: vi.fn().mockResolvedValue(undefined),
    refreshData: vi.fn().mockResolvedValue(undefined),
    setLocationOverride: vi.fn().mockResolvedValue(undefined),
    clearLocationOverride: vi.fn().mockResolvedValue(undefined),
    setBrowserCoords: vi.fn().mockResolvedValue(undefined),
    markLocationPermissionAsked: vi.fn().mockResolvedValue(undefined),
    onSettingsChanged: vi.fn().mockReturnValue(() => {}),
    getTheme: vi.fn().mockResolvedValue(initialTheme),
    onThemeChanged: vi.fn((cb: ThemeListener) => {
      themeListeners.push(cb);
      return () => {
        const i = themeListeners.indexOf(cb);
        if (i >= 0) themeListeners.splice(i, 1);
      };
    }),
    getData: vi.fn().mockResolvedValue(SNAPSHOT),
    onDataChanged: vi.fn().mockReturnValue(() => {}),
  };
  (window as unknown as { glimpse: unknown }).glimpse = stub;
  return {
    pushTheme: (t) => {
      for (const cb of themeListeners) cb(t);
    },
  };
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { glimpse?: unknown }).glimpse;
});

describe('Live theme switching — main → renderer push', () => {
  it('renders the spec-required 200 ms theme cross-fade duration on slide faces', async () => {
    installStub();
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    await flushAsync();

    const slide = screen.getByTestId('slide-today');
    expect(slide.getAttribute('data-theme-transition-duration-s')).toBe(
      String(THEME_TRANSITION_DURATION_S),
    );
    expect(THEME_TRANSITION_DURATION_S).toBe(0.2);
  });

  it('updates the SlideDeck themeMode when a theme:changed push arrives', async () => {
    const { pushTheme } = installStub('dark');
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    await flushAsync();

    expect(
      screen.getByTestId('slide-deck').getAttribute('data-theme-mode'),
    ).toBe('dark');

    act(() => {
      pushTheme('light');
    });
    await flushAsync();

    expect(
      screen.getByTestId('slide-deck').getAttribute('data-theme-mode'),
    ).toBe('light');
  });

  it('reflects the initial theme from getTheme() — not the synchronous default', async () => {
    installStub('light');
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    await flushAsync();

    expect(
      screen.getByTestId('slide-deck').getAttribute('data-theme-mode'),
    ).toBe('light');
  });

  it('keeps the today slide at dark luminance regardless of resolved theme', async () => {
    const { pushTheme } = installStub('light');
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    await flushAsync();

    act(() => {
      pushTheme('light');
    });
    await flushAsync();

    // Plan/styling.md: "Settings is the only theme-adaptive slide
    // background." Today (and every other non-Settings slide) stays
    // dark even when the resolved theme is light.
    expect(
      screen.getByTestId('slide-today').getAttribute('data-slide-luminance'),
    ).toBe('dark');
  });
});
