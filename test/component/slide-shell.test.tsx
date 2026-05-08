import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  SlideShell,
  SLIDE_TITLE_AREA_PX,
} from '../../src/renderer/src/components/slide-shell';

afterEach(cleanup);

describe('SlideShell', () => {
  it('renders the title element with the provided text + data attribute', () => {
    render(
      <SlideShell title="Today">
        <div data-testid="body-content">body</div>
      </SlideShell>,
    );
    const title = screen.getByTestId('slide-title');
    expect(title).toHaveTextContent('Today');
    expect(title.getAttribute('data-slide-title')).toBe('Today');
  });

  it('renders children inside the body region (sibling, not replacement)', () => {
    render(
      <SlideShell title="Whatever">
        <div data-testid="body-content">child</div>
      </SlideShell>,
    );
    const body = screen.getByTestId('slide-body');
    expect(body).toContainElement(screen.getByTestId('body-content'));
  });

  it('reserves vertical space for the title at the top of the body', () => {
    render(
      <SlideShell title="Today">
        <div>x</div>
      </SlideShell>,
    );
    const body = screen.getByTestId('slide-body');
    // Body starts at SLIDE_TITLE_AREA_PX from the top — that's the gap
    // we leave for the title bar.
    expect(body.style.top).toBe(`${SLIDE_TITLE_AREA_PX}px`);
    expect(body.style.left).toBe('0px');
    expect(body.style.right).toBe('0px');
    expect(body.style.bottom).toBe('0px');
  });

  it('forwards the optional testId to the outer wrapper', () => {
    render(
      <SlideShell title="Today" testId="my-shell">
        <div>x</div>
      </SlideShell>,
    );
    expect(screen.getByTestId('my-shell')).toBeInTheDocument();
  });
});
