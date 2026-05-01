import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import {
  RESIZE_HANDLE_SIZE_PX,
  ResizeHandles,
} from '../../src/renderer/src/components/resize-handles';
import type { ResizeCorner } from '../../src/shared/window-position';

type GlimpseStub = {
  resizeStart: ReturnType<typeof vi.fn>;
  resizeMove: ReturnType<typeof vi.fn>;
  resizeEnd: ReturnType<typeof vi.fn>;
};

function installGlimpseStub(): GlimpseStub {
  const stub: GlimpseStub = {
    resizeStart: vi.fn(),
    resizeMove: vi.fn(),
    resizeEnd: vi.fn(),
  };
  (window as unknown as { glimpse: GlimpseStub }).glimpse = stub;
  return stub;
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { glimpse?: unknown }).glimpse;
});

const corners: ResizeCorner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

describe('ResizeHandles layout', () => {
  it('renders one handle per corner', () => {
    render(<ResizeHandles />);
    for (const corner of corners) {
      expect(screen.getByTestId(`resize-handle-${corner}`)).toBeInTheDocument();
    }
  });

  it('uses nwse-resize cursor for opposite-diagonal corners', () => {
    render(<ResizeHandles />);
    expect(screen.getByTestId('resize-handle-top-left').style.cursor).toBe(
      'nwse-resize',
    );
    expect(screen.getByTestId('resize-handle-bottom-right').style.cursor).toBe(
      'nwse-resize',
    );
  });

  it('uses nesw-resize cursor for the other-diagonal corners', () => {
    render(<ResizeHandles />);
    expect(screen.getByTestId('resize-handle-top-right').style.cursor).toBe(
      'nesw-resize',
    );
    expect(screen.getByTestId('resize-handle-bottom-left').style.cursor).toBe(
      'nesw-resize',
    );
  });

  it('positions each handle in its corner with the configured size', () => {
    render(<ResizeHandles />);
    const tl = screen.getByTestId('resize-handle-top-left');
    expect(tl.style.position).toBe('absolute');
    expect(tl.style.width).toBe(`${RESIZE_HANDLE_SIZE_PX}px`);
    expect(tl.style.height).toBe(`${RESIZE_HANDLE_SIZE_PX}px`);
    expect(tl.style.top).toBe('0px');
    expect(tl.style.left).toBe('0px');

    const br = screen.getByTestId('resize-handle-bottom-right');
    expect(br.style.bottom).toBe('0px');
    expect(br.style.right).toBe('0px');
  });
});

describe('ResizeHandles IPC flow', () => {
  it.each(corners)(
    'mousedown on %s handle fires resize:start with that corner',
    (corner) => {
      const stub = installGlimpseStub();
      render(<ResizeHandles />);
      fireEvent.mouseDown(screen.getByTestId(`resize-handle-${corner}`), {
        screenX: 800,
        screenY: 400,
      });
      expect(stub.resizeStart).toHaveBeenCalledTimes(1);
      expect(stub.resizeStart).toHaveBeenCalledWith(corner, {
        x: 800,
        y: 400,
      });
    },
  );

  it('window-level mousemove after a started resize fires resize:move', () => {
    const stub = installGlimpseStub();
    render(<ResizeHandles />);
    fireEvent.mouseDown(screen.getByTestId('resize-handle-bottom-right'), {
      screenX: 800,
      screenY: 400,
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 850, screenY: 450 }),
      );
    });
    expect(stub.resizeMove).toHaveBeenCalledTimes(1);
    expect(stub.resizeMove).toHaveBeenCalledWith({ x: 850, y: 450 });
  });

  it('mouseup ends the resize and stops further moves', () => {
    const stub = installGlimpseStub();
    render(<ResizeHandles />);
    fireEvent.mouseDown(screen.getByTestId('resize-handle-bottom-right'), {
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
    expect(stub.resizeEnd).toHaveBeenCalledTimes(1);
    expect(stub.resizeEnd).toHaveBeenCalledWith({ x: 900, y: 500 });
    expect(stub.resizeMove).not.toHaveBeenCalled();
  });

  it('window-level mousemove without a started resize is ignored', () => {
    const stub = installGlimpseStub();
    render(<ResizeHandles />);
    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousemove', { screenX: 100, screenY: 100 }),
      );
    });
    expect(stub.resizeMove).not.toHaveBeenCalled();
  });
});
