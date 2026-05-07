import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { IconView } from '../../src/renderer/src/views/icon-view';
import {
  EMPTY_SNAPSHOT,
  type DataSnapshot,
} from '../../src/shared/data-snapshot';
import type { Forecast } from '../../src/shared/forecast';

// Forecast that maps to a "ready" icon. The icon view only inspects
// forecast.current.condition, so the rest of the structure is filled
// minimally just to satisfy the type.
function readyForecast(condition: Forecast['current']['condition']): Forecast {
  return {
    timezone: 'UTC',
    current: {
      time: '2026-05-04T12:00',
      temperature: 20,
      apparentTemperature: 19,
      humidity: 50,
      weatherCode: 0,
      condition,
      windSpeed: 5,
      windDirection: 180,
      precipitation: 0,
    },
    hourly: [],
    daily: [],
  };
}

type DataChangedListener = (snap: DataSnapshot) => void;

type GlimpseStub = {
  dragStart: ReturnType<typeof vi.fn>;
  dragMove: ReturnType<typeof vi.fn>;
  dragEnd: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
  getData: ReturnType<typeof vi.fn>;
  onDataChanged: ReturnType<typeof vi.fn>;
  __dataListeners: DataChangedListener[];
};

function installGlimpseStub(initial: DataSnapshot): GlimpseStub {
  const listeners: DataChangedListener[] = [];
  const stub: GlimpseStub = {
    dragStart: vi.fn(),
    dragMove: vi.fn(),
    dragEnd: vi.fn(),
    expand: vi.fn().mockResolvedValue(undefined),
    getData: vi.fn().mockResolvedValue(initial),
    onDataChanged: vi.fn((cb: DataChangedListener) => {
      listeners.push(cb);
      return () => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }),
    __dataListeners: listeners,
  };
  (window as unknown as { glimpse: unknown }).glimpse = stub;
  return stub;
}

function clearGlimpseStub(): void {
  delete (window as unknown as { glimpse?: unknown }).glimpse;
}

// flushes the getData() promise + the React effect that consumes it.
async function flushGetData(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  clearGlimpseStub();
  cleanup();
});

describe('IconView — data-snapshot wiring', () => {
  it('renders the loading cloud before the first snapshot resolves', () => {
    // Stall getData so the initial state is "no snapshot yet".
    const stub = installGlimpseStub({ ...EMPTY_SNAPSHOT });
    stub.getData.mockReturnValueOnce(
      new Promise<DataSnapshot>(() => {
        /* never resolves */
      }),
    );
    render(<IconView />);
    const root = screen.getByTestId('icon-root');
    expect(root.getAttribute('data-icon-state')).toBe('loading');
  });

  it('renders the loading cloud when the snapshot has no forecast yet', async () => {
    installGlimpseStub({ ...EMPTY_SNAPSHOT });
    render(<IconView />);
    await flushGetData();
    const root = screen.getByTestId('icon-root');
    expect(root.getAttribute('data-icon-state')).toBe('loading');
  });

  it('renders the sad cloud when errorState is "error"', async () => {
    installGlimpseStub({
      ...EMPTY_SNAPSHOT,
      errorState: 'error',
    });
    render(<IconView />);
    await flushGetData();
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
    expect(
      screen.getByTestId('icon-root').getAttribute('data-icon-state'),
    ).toBe('error');
  });

  it('renders the ready glyph driven by forecast.current.condition', async () => {
    installGlimpseStub({
      ...EMPTY_SNAPSHOT,
      forecast: readyForecast('rain'),
      lastUpdated: '2026-05-04T12:00:00Z',
    });
    render(<IconView />);
    await flushGetData();
    const ready = screen.getByTestId('icon-ready');
    // 'rain' + isDay:true → WiDayRain per condition→glyph mapping.
    expect(ready.getAttribute('data-glyph')).toBe('WiDayRain');
  });

  it('flips from ready to error when a data:changed push reports a failure', async () => {
    const stub = installGlimpseStub({
      ...EMPTY_SNAPSHOT,
      forecast: readyForecast('clear'),
    });
    render(<IconView />);
    await flushGetData();
    expect(screen.getByTestId('icon-ready')).toBeInTheDocument();

    act(() => {
      for (const cb of stub.__dataListeners) {
        cb({
          ...EMPTY_SNAPSHOT,
          errorState: 'error',
        });
      }
    });
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
  });

  it('recovers from error to ready on the next successful push', async () => {
    const stub = installGlimpseStub({
      ...EMPTY_SNAPSHOT,
      errorState: 'error',
    });
    render(<IconView />);
    await flushGetData();
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();

    act(() => {
      for (const cb of stub.__dataListeners) {
        cb({
          ...EMPTY_SNAPSHOT,
          forecast: readyForecast('cloudy'),
          lastUpdated: '2026-05-04T12:00:00Z',
        });
      }
    });
    const ready = screen.getByTestId('icon-ready');
    expect(ready.getAttribute('data-glyph')).toBe('WiCloudy');
  });
});
