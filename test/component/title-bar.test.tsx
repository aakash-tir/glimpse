import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  TitleBar,
  TITLE_BAR_FADE_IN_MS,
  TITLE_BAR_FADE_OUT_MS,
  TITLE_BAR_HEIGHT_PX,
  TITLE_BAR_TRIGGER_HEIGHT_PX,
} from '../../src/renderer/src/components/title-bar';

afterEach(cleanup);

describe('TitleBar layout', () => {
  it('renders the weather icon, wordmark, and two right-side buttons', () => {
    render(<TitleBar />);
    expect(screen.getByTestId('title-bar-weather-icon')).toBeInTheDocument();
    expect(screen.getByTestId('title-bar-wordmark')).toBeInTheDocument();
    expect(screen.getByText('Glimpse')).toBeInTheDocument();
    expect(screen.getByTestId('title-bar-minimize')).toBeInTheDocument();
    expect(screen.getByTestId('title-bar-close')).toBeInTheDocument();
    // The relocate button was removed; its function (collapse + reset
    // to default) was absorbed into the minimize button.
    expect(screen.queryByTestId('title-bar-relocate')).toBeNull();
  });

  it('renders the minimize-to-icon glyph as a custom SVG (not a stock lucide icon)', () => {
    render(<TitleBar />);
    expect(screen.getByTestId('title-bar-minimize-glyph')).toBeInTheDocument();
  });

  it('exposes the spec-required heights and fade timings as data attributes', () => {
    render(<TitleBar />);
    const container = screen.getByTestId('title-bar-container');
    expect(container.getAttribute('data-trigger-height-px')).toBe(
      String(TITLE_BAR_TRIGGER_HEIGHT_PX),
    );
    expect(container.getAttribute('data-bar-height-px')).toBe(
      String(TITLE_BAR_HEIGHT_PX),
    );
    expect(container.getAttribute('data-fade-in-ms')).toBe(
      String(TITLE_BAR_FADE_IN_MS),
    );
    expect(container.getAttribute('data-fade-out-ms')).toBe(
      String(TITLE_BAR_FADE_OUT_MS),
    );
  });

  it('uses white-70% wordmark color on dark background (default)', () => {
    render(<TitleBar background="dark" />);
    const wordmark = screen.getByTestId('title-bar-wordmark');
    expect(wordmark.style.color).toBe('rgba(255, 255, 255, 0.7)');
  });

  it('uses slate-70% wordmark color on light background', () => {
    render(<TitleBar background="light" />);
    const wordmark = screen.getByTestId('title-bar-wordmark');
    expect(wordmark.style.color).toBe('rgba(15, 23, 42, 0.7)');
  });
});

describe('TitleBar auto-hide', () => {
  it('starts invisible (opacity 0, pointer-events none, container at trigger height)', () => {
    render(<TitleBar />);
    const container = screen.getByTestId('title-bar-container');
    const bar = screen.getByTestId('title-bar');

    expect(container.getAttribute('data-visible')).toBe('off');
    expect(container.style.height).toBe(`${TITLE_BAR_TRIGGER_HEIGHT_PX}px`);
    expect(bar.style.pointerEvents).toBe('none');
  });

  it('on hover, becomes visible and grows the hover container to the bar height', () => {
    render(<TitleBar />);
    const container = screen.getByTestId('title-bar-container');
    const bar = screen.getByTestId('title-bar');

    fireEvent.mouseEnter(container);

    expect(container.getAttribute('data-visible')).toBe('on');
    expect(container.style.height).toBe(`${TITLE_BAR_HEIGHT_PX}px`);
    expect(bar.style.pointerEvents).toBe('auto');
  });

  it('on mouse leave, returns to invisible + trigger-height', () => {
    render(<TitleBar />);
    const container = screen.getByTestId('title-bar-container');

    fireEvent.mouseEnter(container);
    expect(container.getAttribute('data-visible')).toBe('on');

    fireEvent.mouseLeave(container);
    expect(container.getAttribute('data-visible')).toBe('off');
    expect(container.style.height).toBe(`${TITLE_BAR_TRIGGER_HEIGHT_PX}px`);
  });
});

describe('TitleBar disabled (during window drag)', () => {
  it('exposes the disabled state via data attribute', () => {
    render(<TitleBar disabled />);
    const container = screen.getByTestId('title-bar-container');
    expect(container.getAttribute('data-disabled')).toBe('on');
  });

  it('disables pointer-events on the trigger so events fall through to the panel', () => {
    render(<TitleBar disabled />);
    const container = screen.getByTestId('title-bar-container');
    expect(container.style.pointerEvents).toBe('none');
  });

  it('stays invisible even when hovered', () => {
    render(<TitleBar disabled />);
    const container = screen.getByTestId('title-bar-container');
    fireEvent.mouseEnter(container);
    expect(container.getAttribute('data-visible')).toBe('off');
  });
});

describe('TitleBar click handlers', () => {
  it('weather-icon click invokes onWeatherIconClick', () => {
    const cb = vi.fn();
    render(<TitleBar onWeatherIconClick={cb} />);
    fireEvent.click(screen.getByTestId('title-bar-weather-icon'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('minimize click invokes onMinimize', () => {
    const cb = vi.fn();
    render(<TitleBar onMinimize={cb} />);
    fireEvent.click(screen.getByTestId('title-bar-minimize'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('close click invokes onClose', () => {
    const cb = vi.fn();
    render(<TitleBar onClose={cb} />);
    fireEvent.click(screen.getByTestId('title-bar-close'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not throw when handlers are not provided', () => {
    render(<TitleBar />);
    fireEvent.click(screen.getByTestId('title-bar-weather-icon'));
    fireEvent.click(screen.getByTestId('title-bar-minimize'));
    fireEvent.click(screen.getByTestId('title-bar-close'));
    expect(true).toBe(true);
  });
});
