import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import { App } from '../../src/renderer/src/App';
import { DOUBLE_CLICK_THRESHOLD_MS } from '../../src/shared/click-classifier';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function clickIcon(): void {
  fireEvent.click(screen.getByTestId('icon-root'));
}

function clickAppContainer(): void {
  fireEvent.click(screen.getByTestId('app-root'));
}

function fastForward(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('drag mode (App-level)', () => {
  it('starts with drag mode off and no glow rendered', () => {
    render(<App />);
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
    expect(screen.getByTestId('app-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
    expect(screen.queryByTestId('drag-mode-glow')).toBeNull();
  });

  it('double-click within 250 ms enters drag mode and shows the glow', () => {
    render(<App />);
    clickIcon();
    fastForward(100);
    clickIcon();

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );
    expect(screen.queryByTestId('drag-mode-glow')).not.toBeNull();
  });

  it('two clicks separated by more than 250 ms do not enter drag mode', () => {
    render(<App />);
    clickIcon();
    fastForward(DOUBLE_CLICK_THRESHOLD_MS + 50);
    clickIcon();
    // After the second click's settle window, still off.
    fastForward(DOUBLE_CLICK_THRESHOLD_MS + 50);

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
    expect(screen.queryByTestId('drag-mode-glow')).toBeNull();
  });

  it('a second double-click toggles drag mode back off', () => {
    render(<App />);
    clickIcon();
    fastForward(50);
    clickIcon();
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );

    clickIcon();
    fastForward(50);
    clickIcon();
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
    expect(screen.queryByTestId('drag-mode-glow')).toBeNull();
  });

  it('a single click on the icon while in drag mode does NOT exit drag mode', () => {
    render(<App />);
    // Enter drag mode.
    clickIcon();
    fastForward(50);
    clickIcon();
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );

    // One isolated click followed by the threshold elapsing (no second click).
    clickIcon();
    fastForward(DOUBLE_CLICK_THRESHOLD_MS + 50);

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );
    expect(screen.queryByTestId('drag-mode-glow')).not.toBeNull();
  });

  it('clicking the transparent app area exits drag mode', () => {
    render(<App />);
    clickIcon();
    fastForward(50);
    clickIcon();
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );

    clickAppContainer();

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
    expect(screen.queryByTestId('drag-mode-glow')).toBeNull();
  });

  it('window blur exits drag mode', () => {
    render(<App />);
    clickIcon();
    fastForward(50);
    clickIcon();
    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'off',
    );
  });

  it('clicks on the icon do not bubble to the app container (no spurious exit)', () => {
    render(<App />);
    // Enter drag mode.
    clickIcon();
    fastForward(50);
    clickIcon();

    // Single click on the icon — should NOT exit drag mode by bubbling
    // up to the app-root outside-click handler.
    clickIcon();
    fastForward(DOUBLE_CLICK_THRESHOLD_MS + 50);

    expect(screen.getByTestId('icon-root').getAttribute('data-drag-mode')).toBe(
      'on',
    );
  });
});
