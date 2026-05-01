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

type GlimpseStub = {
  dragStart: ReturnType<typeof vi.fn>;
  dragMove: ReturnType<typeof vi.fn>;
  dragEnd: ReturnType<typeof vi.fn>;
};

function installGlimpseStub(): GlimpseStub {
  const stub: GlimpseStub = {
    dragStart: vi.fn(),
    dragMove: vi.fn(),
    dragEnd: vi.fn(),
  };
  (window as unknown as { glimpse: GlimpseStub }).glimpse = stub;
  return stub;
}

function clearGlimpseStub(): void {
  delete (window as unknown as { glimpse?: unknown }).glimpse;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearGlimpseStub();
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

describe('drag IPC flow (mousedown → mousemove → mouseup)', () => {
  function enterDragMode(): void {
    fireEvent.click(screen.getByTestId('icon-root'));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(screen.getByTestId('icon-root'));
  }

  it('mousedown on the icon while in drag mode fires drag:start', () => {
    const stub = installGlimpseStub();
    render(<App />);
    enterDragMode();

    fireEvent.mouseDown(screen.getByTestId('icon-root'), {
      screenX: 1000,
      screenY: 500,
    });

    expect(stub.dragStart).toHaveBeenCalledTimes(1);
    expect(stub.dragStart).toHaveBeenCalledWith({ x: 1000, y: 500 });
  });

  it('mousedown on the icon when NOT in drag mode does NOT fire drag:start', () => {
    const stub = installGlimpseStub();
    render(<App />);
    fireEvent.mouseDown(screen.getByTestId('icon-root'), {
      screenX: 1000,
      screenY: 500,
    });
    expect(stub.dragStart).not.toHaveBeenCalled();
  });

  it('mousemove after a started drag fires drag:move with current cursor', () => {
    const stub = installGlimpseStub();
    render(<App />);
    enterDragMode();
    fireEvent.mouseDown(screen.getByTestId('icon-root'), {
      screenX: 1000,
      screenY: 500,
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 1100, screenY: 600 }),
      );
    });

    expect(stub.dragMove).toHaveBeenCalledTimes(1);
    expect(stub.dragMove).toHaveBeenCalledWith({ x: 1100, y: 600 });
  });

  it('mouseup ends the drag and fires drag:end exactly once', () => {
    const stub = installGlimpseStub();
    render(<App />);
    enterDragMode();
    fireEvent.mouseDown(screen.getByTestId('icon-root'), {
      screenX: 1000,
      screenY: 500,
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 1234, screenY: 678 }),
      );
    });
    // A subsequent mousemove (without a fresh mousedown) must NOT keep
    // streaming move events.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 9999, screenY: 9999 }),
      );
    });

    expect(stub.dragEnd).toHaveBeenCalledTimes(1);
    expect(stub.dragEnd).toHaveBeenCalledWith({ x: 1234, y: 678 });
    expect(stub.dragMove).not.toHaveBeenCalled();
  });

  it('mousemove without a started drag is ignored', () => {
    const stub = installGlimpseStub();
    render(<App />);
    enterDragMode();
    // No mousedown beforehand.
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 1100, screenY: 600 }),
      );
    });
    expect(stub.dragMove).not.toHaveBeenCalled();
  });
});
