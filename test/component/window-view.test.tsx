import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import { WindowView } from '../../src/renderer/src/views/window-view';
import { ICON_SIZE } from '../../src/shared/icon-position';
import { DOUBLE_CLICK_THRESHOLD_MS } from '../../src/shared/click-classifier';

type GlimpseStub = {
  dragStart: ReturnType<typeof vi.fn>;
  dragMove: ReturnType<typeof vi.fn>;
  dragEnd: ReturnType<typeof vi.fn>;
  collapse: ReturnType<typeof vi.fn>;
  previewCollapseAnchor: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  getMode: ReturnType<typeof vi.fn>;
  expand: ReturnType<typeof vi.fn>;
  onModeChanged: ReturnType<typeof vi.fn>;
};

function installGlimpseStub(): GlimpseStub {
  const stub: GlimpseStub = {
    dragStart: vi.fn(),
    dragMove: vi.fn(),
    dragEnd: vi.fn(),
    collapse: vi.fn().mockResolvedValue('icon'),
    previewCollapseAnchor: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    quit: vi.fn(),
    getMode: vi.fn().mockResolvedValue('window'),
    expand: vi.fn().mockResolvedValue('window'),
    onModeChanged: vi.fn().mockReturnValue(() => {}),
  };
  (window as unknown as { glimpse: GlimpseStub }).glimpse = stub;
  return stub;
}

function clearGlimpseStub(): void {
  delete (window as unknown as { glimpse?: unknown }).glimpse;
}

afterEach(() => {
  cleanup();
  clearGlimpseStub();
});

describe('WindowView entry animation', () => {
  it('renders without an entry anchor (initial mount)', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    const view = screen.getByTestId('window-view');
    expect(view).toBeInTheDocument();
    expect(view.getAttribute('data-enter-scale')).toBe('1');
  });

  it('uses transform-origin set to the icon-center anchor when present', () => {
    render(
      <WindowView
        enterAnchor={{ x: 156, y: 28 }}
        enterBounds={{ width: 180, height: 180 }}
      />,
    );
    const view = screen.getByTestId('window-view');
    expect(view.getAttribute('data-enter-anchor-x')).toBe('156');
    expect(view.getAttribute('data-enter-anchor-y')).toBe('28');
    expect(view.style.transformOrigin).toBe('156px 28px');
  });

  it('starts the animation at scale = ICON_SIZE / window-side', () => {
    const enterBounds = { width: 180, height: 180 };
    render(
      <WindowView enterAnchor={{ x: 90, y: 90 }} enterBounds={enterBounds} />,
    );
    const view = screen.getByTestId('window-view');
    const expected = (ICON_SIZE / 180).toString();
    expect(view.getAttribute('data-enter-scale')).toBe(expected);
  });

  it('uses the larger window dimension if width and height differ', () => {
    render(
      <WindowView
        enterAnchor={{ x: 0, y: 0 }}
        enterBounds={{ width: 200, height: 100 }}
      />,
    );
    const view = screen.getByTestId('window-view');
    const expected = (ICON_SIZE / 200).toString();
    expect(view.getAttribute('data-enter-scale')).toBe(expected);
  });

  it('exposes the scale animation duration as a data attribute', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    const view = screen.getByTestId('window-view');
    expect(view.getAttribute('data-window-scale-duration-s')).toBe('0.2');
  });
});

describe('WindowView drag mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installGlimpseStub();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getView(): HTMLElement {
    return screen.getByTestId('window-view');
  }

  function doubleClickPanel(): void {
    const view = getView();
    fireEvent.click(view);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(view);
  }

  it('starts with drag mode off (no glow rendered)', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    expect(getView().getAttribute('data-drag-mode')).toBe('off');
    expect(screen.queryByTestId('drag-mode-glow')).toBeNull();
  });

  it('double-clicking the panel toggles drag mode on and renders the glow', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    doubleClickPanel();
    expect(getView().getAttribute('data-drag-mode')).toBe('on');
    expect(screen.queryByTestId('drag-mode-glow')).not.toBeNull();
  });

  it('single click on the panel does NOT enter drag mode', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    fireEvent.click(getView());
    act(() => {
      vi.advanceTimersByTime(DOUBLE_CLICK_THRESHOLD_MS + 50);
    });
    expect(getView().getAttribute('data-drag-mode')).toBe('off');
  });

  it('a second double-click toggles drag mode back off', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    doubleClickPanel();
    expect(getView().getAttribute('data-drag-mode')).toBe('on');
    doubleClickPanel();
    expect(getView().getAttribute('data-drag-mode')).toBe('off');
  });

  it('disables the title bar while drag mode is active', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    expect(
      screen.getByTestId('title-bar-container').getAttribute('data-disabled'),
    ).toBe('off');
    doubleClickPanel();
    expect(
      screen.getByTestId('title-bar-container').getAttribute('data-disabled'),
    ).toBe('on');
  });

  it('window blur exits drag mode', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    doubleClickPanel();
    expect(getView().getAttribute('data-drag-mode')).toBe('on');
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(getView().getAttribute('data-drag-mode')).toBe('off');
  });
});

describe('WindowView drag IPC flow (drag mode active)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function enterDragMode(): void {
    const view = screen.getByTestId('window-view');
    fireEvent.click(view);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.click(view);
  }

  it('mousedown on the panel while in drag mode fires drag:start', () => {
    const stub = installGlimpseStub();
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    enterDragMode();

    fireEvent.mouseDown(screen.getByTestId('window-view'), {
      screenX: 800,
      screenY: 400,
    });

    expect(stub.dragStart).toHaveBeenCalledTimes(1);
    expect(stub.dragStart).toHaveBeenCalledWith({ x: 800, y: 400 });
  });

  it('mousedown on the panel when NOT in drag mode does NOT fire drag:start', () => {
    const stub = installGlimpseStub();
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    fireEvent.mouseDown(screen.getByTestId('window-view'), {
      screenX: 800,
      screenY: 400,
    });
    expect(stub.dragStart).not.toHaveBeenCalled();
  });

  it('mousemove after a started drag fires drag:move', () => {
    const stub = installGlimpseStub();
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    enterDragMode();
    fireEvent.mouseDown(screen.getByTestId('window-view'), {
      screenX: 800,
      screenY: 400,
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 850, screenY: 420 }),
      );
    });

    expect(stub.dragMove).toHaveBeenCalledTimes(1);
    expect(stub.dragMove).toHaveBeenCalledWith({ x: 850, y: 420 });
  });

  it('mouseup ends the drag exactly once and stops further moves', () => {
    const stub = installGlimpseStub();
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    enterDragMode();
    fireEvent.mouseDown(screen.getByTestId('window-view'), {
      screenX: 800,
      screenY: 400,
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mouseup', { screenX: 900, screenY: 500 }),
      );
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 9999, screenY: 9999 }),
      );
    });

    expect(stub.dragEnd).toHaveBeenCalledTimes(1);
    expect(stub.dragEnd).toHaveBeenCalledWith({ x: 900, y: 500 });
    expect(stub.dragMove).not.toHaveBeenCalled();
  });
});
