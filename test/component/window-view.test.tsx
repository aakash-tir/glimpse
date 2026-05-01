import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WindowView } from '../../src/renderer/src/views/window-view';
import { ICON_SIZE } from '../../src/shared/icon-position';

afterEach(cleanup);

describe('WindowView entry animation', () => {
  it('renders without an entry anchor (initial mount)', () => {
    render(<WindowView enterAnchor={null} enterBounds={null} />);
    const view = screen.getByTestId('window-view');
    expect(view).toBeInTheDocument();
    // No anchor → start at scale 1 (no entry animation).
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
    // The window is square in production but defensive coverage: pick
    // the larger dim so the start scale is still ≤ 1.
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
