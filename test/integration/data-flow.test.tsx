// End-to-end-shape integration test for the M5 data-flow chain:
//   failing fetcher  →  real DataStore.refresh()  →  store.subscribe push
//                                                →  glimpse.onDataChanged push
//                                                →  IconView re-renders
//
// Closes the rules/testing.md § M5 "Integration: mocked Open-Meteo
// failure → icon enters error state; recovery on next attempt →
// returns to normal" inventory item with a single test that wires
// the layers together.
//
// Why the layered tests aren't enough on their own:
//   - data-store.test.ts proves the store transitions errorState
//     correctly on fetch failure.
//   - icon-view.test.tsx proves the IconView visualises errorState
//     correctly when one is pushed via a stubbed onDataChanged.
//   - But nothing else in the suite proves that a real failing
//     fetcher → real DataStore → store.subscribe emission actually
//     reaches the IconView. That's the wiring gap that allowed
//     several M5 bugs to slip past CI (see gaps.md F1/F3/F4).
//
// We bridge the real DataStore.subscribe to the stubbed
// glimpse.onDataChanged callback collection, mount the real
// IconView, and observe its data-icon-state attribute as the store
// transitions.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, cleanup, act } from '@testing-library/react';
import { IconView } from '../../src/renderer/src/views/icon-view';
import { DataStore } from '../../src/main/data/store';
import { parseForecast } from '../../src/main/data/open-meteo';
import type { DataSnapshot } from '../../src/shared/data-snapshot';
import type { Forecast } from '../../src/shared/forecast';

const FORECAST_FIXTURE = join(
  __dirname,
  '..',
  '..',
  'fixtures',
  'open-meteo',
  'forecast-success.json',
);

function fixtureForecast(): Forecast {
  return parseForecast(JSON.parse(readFileSync(FORECAST_FIXTURE, 'utf-8')));
}

const sampleLocation = { latitude: 49.8, longitude: -119.2, city: 'Kelowna' };
const sampleKp = { kp: 3, observedAtUtc: '2026-05-04T09:00:00Z' };

type DataChangedListener = (snap: DataSnapshot) => void;

// Wires the renderer-side glimpse bridge stub to the real DataStore
// so a store.refresh() on the main side reaches mounted components on
// the renderer side via the same path production uses (subscribe →
// data:changed → onDataChanged listener).
function installBridgedGlimpseStub(store: DataStore): {
  listeners: DataChangedListener[];
} {
  const listeners: DataChangedListener[] = [];
  // Real production wiring: main process subscribes once and forwards
  // every emission as data:changed. We mirror that here so a single
  // store push fans out to every renderer listener.
  store.subscribe((snap) => {
    for (const cb of listeners) cb(snap);
  });
  const stub = {
    getData: vi.fn(() => Promise.resolve(store.getSnapshot())),
    onDataChanged: vi.fn((cb: DataChangedListener) => {
      listeners.push(cb);
      return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }),
    // Stubs for the IconView's other bridge calls — drag, expand, etc.
    // unused in this test but must exist so IconView renders cleanly.
    dragStart: vi.fn(),
    dragMove: vi.fn(),
    dragEnd: vi.fn(),
    expand: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { glimpse: unknown }).glimpse = stub;
  return { listeners };
}

function clearGlimpseStub(): void {
  delete (window as unknown as { glimpse?: unknown }).glimpse;
}

// Flushes the getData() promise + the React effect that consumes it.
async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  clearGlimpseStub();
  cleanup();
});

describe('Data-flow integration — fetcher → store → IconView', () => {
  it('a failing forecast fetch propagates all the way to the icon error visual', async () => {
    const store = new DataStore({
      fetchGeolocation: vi.fn().mockResolvedValue(sampleLocation),
      fetchForecast: vi
        .fn()
        .mockRejectedValue(new Error('open-meteo: HTTP 503')),
      fetchKp: vi.fn().mockResolvedValue(sampleKp),
    });
    installBridgedGlimpseStub(store);

    render(<IconView />);
    await flushAsync();
    // Pre-refresh the snapshot is EMPTY_SNAPSHOT (errorState 'ok',
    // forecast null) → loading.
    expect(
      screen.getByTestId('icon-root').getAttribute('data-icon-state'),
    ).toBe('loading');

    // Drive the actual fetch — store transitions errorState=error,
    // emits via subscribe, listeners push to IconView, IconView
    // re-renders. Real production data-flow shape end-to-end.
    await act(async () => {
      await store.refresh();
    });
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
    expect(
      screen.getByTestId('icon-root').getAttribute('data-icon-state'),
    ).toBe('error');
  });

  it('a failing geolocation fetch (no prior location) also surfaces as the icon error visual', async () => {
    const store = new DataStore({
      fetchGeolocation: vi.fn().mockRejectedValue(new Error('geolocation 429')),
      fetchForecast: vi.fn().mockResolvedValue(fixtureForecast()),
      fetchKp: vi.fn().mockResolvedValue(sampleKp),
    });
    installBridgedGlimpseStub(store);
    render(<IconView />);
    await flushAsync();

    await act(async () => {
      await store.refresh();
    });
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
  });

  it('recovers from error to ready when the next fetch succeeds', async () => {
    const fetchForecast = vi
      .fn()
      .mockRejectedValueOnce(new Error('open-meteo: HTTP 503'))
      .mockResolvedValue(fixtureForecast());
    const store = new DataStore({
      fetchGeolocation: vi.fn().mockResolvedValue(sampleLocation),
      fetchForecast,
      fetchKp: vi.fn().mockResolvedValue(sampleKp),
    });
    installBridgedGlimpseStub(store);
    render(<IconView />);
    await flushAsync();

    await act(async () => {
      await store.refresh();
    });
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();

    await act(async () => {
      await store.refresh();
    });
    // Recovered → ready glyph rendered, error glyph gone.
    expect(screen.getByTestId('icon-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-sad-cloud')).not.toBeInTheDocument();
  });

  it('NOAA failure does NOT push the icon into error state when weather succeeds', async () => {
    const store = new DataStore({
      fetchGeolocation: vi.fn().mockResolvedValue(sampleLocation),
      fetchForecast: vi.fn().mockResolvedValue(fixtureForecast()),
      fetchKp: vi.fn().mockRejectedValue(new Error('noaa-swpc 500')),
    });
    installBridgedGlimpseStub(store);
    render(<IconView />);
    await flushAsync();

    await act(async () => {
      await store.refresh();
    });
    // eventsHidden flag flips per spec but the icon stays normal.
    expect(store.getSnapshot().eventsHidden).toBe(true);
    expect(screen.getByTestId('icon-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-sad-cloud')).not.toBeInTheDocument();
  });
});
