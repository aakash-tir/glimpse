import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SlideIndicator } from '../../src/renderer/src/components/slide-indicator';
import { SlideDeck } from '../../src/renderer/src/components/slide-deck';

afterEach(cleanup);

describe('SlideIndicator — basic rendering', () => {
  it('renders one dot per slide', () => {
    render(
      <SlideIndicator
        currentIndex={0}
        slideCount={4}
        backgroundLuminance="dark"
      />,
    );
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('4');
    expect(screen.getByTestId('slide-dot-0')).toBeInTheDocument();
    expect(screen.getByTestId('slide-dot-1')).toBeInTheDocument();
    expect(screen.getByTestId('slide-dot-2')).toBeInTheDocument();
    expect(screen.getByTestId('slide-dot-3')).toBeInTheDocument();
    expect(screen.queryByTestId('slide-dot-4')).toBeNull();
  });

  it('marks the active dot and only the active dot as data-active="on"', () => {
    render(
      <SlideIndicator
        currentIndex={2}
        slideCount={4}
        backgroundLuminance="dark"
      />,
    );
    expect(screen.getByTestId('slide-dot-0').getAttribute('data-active')).toBe(
      'off',
    );
    expect(screen.getByTestId('slide-dot-1').getAttribute('data-active')).toBe(
      'off',
    );
    expect(screen.getByTestId('slide-dot-2').getAttribute('data-active')).toBe(
      'on',
    );
    expect(screen.getByTestId('slide-dot-3').getAttribute('data-active')).toBe(
      'off',
    );
  });

  it('renders the active dot larger than the inactive dots', () => {
    render(
      <SlideIndicator
        currentIndex={1}
        slideCount={3}
        backgroundLuminance="dark"
      />,
    );
    const inactive = parseInt(
      screen.getByTestId('slide-dot-0').getAttribute('data-size-px') ?? '0',
      10,
    );
    const active = parseInt(
      screen.getByTestId('slide-dot-1').getAttribute('data-size-px') ?? '0',
      10,
    );
    expect(active).toBeGreaterThan(inactive);
  });
});

describe('SlideIndicator — adaptive dot color', () => {
  it('uses light dots on dark slide backgrounds', () => {
    render(
      <SlideIndicator
        currentIndex={0}
        slideCount={3}
        backgroundLuminance="dark"
      />,
    );
    const dot = screen.getByTestId('slide-dot-0');
    expect(dot.style.background).toMatch(/255,\s*255,\s*255/);
  });

  it('uses dark dots on the (light-mode) Settings slide background', () => {
    render(
      <SlideIndicator
        currentIndex={0}
        slideCount={3}
        backgroundLuminance="light"
      />,
    );
    const dot = screen.getByTestId('slide-dot-0');
    // Slate-900-ish: rgb(15, 23, 42).
    expect(dot.style.background).toMatch(/15,\s*23,\s*42/);
  });
});

describe('SlideIndicator — wired through SlideDeck', () => {
  it('updates the active dot when the slide changes', () => {
    render(<SlideDeck />);
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-current-index'),
    ).toBe('0');
    expect(screen.getByTestId('slide-dot-0').getAttribute('data-active')).toBe(
      'on',
    );

    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-current-index'),
    ).toBe('1');
    expect(screen.getByTestId('slide-dot-0').getAttribute('data-active')).toBe(
      'off',
    );
    expect(screen.getByTestId('slide-dot-1').getAttribute('data-active')).toBe(
      'on',
    );
  });

  it('grows the dot count when moon-phase slide is enabled', () => {
    const { rerender } = render(<SlideDeck moonEnabled={false} />);
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('4');

    rerender(<SlideDeck moonEnabled />);
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('5');
  });

  it('grows the dot count when events become active', () => {
    const { rerender } = render(<SlideDeck events={[]} />);
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('4');

    rerender(
      <SlideDeck
        events={[
          {
            type: 'aurora',
            id: 'event:aurora',
            dayOffset: 0,
            kp: 6,
            latitude: 60,
            visibilityText: 'Visible from your location',
          },
        ]}
      />,
    );
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('5');
  });

  it('shrinks the dot count when events disappear', () => {
    const { rerender } = render(
      <SlideDeck
        events={[
          {
            type: 'aurora',
            id: 'event:aurora',
            dayOffset: 0,
            kp: 6,
            latitude: 60,
            visibilityText: 'Visible from your location',
          },
        ]}
      />,
    );
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('5');

    rerender(<SlideDeck events={[]} />);
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('4');
  });

  it('grows by one dot per active event when multiple are active', () => {
    render(
      <SlideDeck
        events={[
          {
            type: 'aurora',
            id: 'event:aurora',
            dayOffset: 0,
            kp: 6,
            latitude: 60,
            visibilityText: 'Visible from your location',
          },
          {
            type: 'meteor',
            id: 'event:meteor:Perseids',
            dayOffset: 0,
            shower: {
              name: 'Perseids',
              peakDate: '2026-08-12',
              zhr: 100,
              bestViewingTime: 'Late night to pre-dawn',
              radiantConstellation: 'Perseus',
            },
          },
        ]}
      />,
    );
    expect(
      screen.getByTestId('slide-indicator').getAttribute('data-slide-count'),
    ).toBe('6');
  });

  it('uses light dots on dark slides (today, default theme)', () => {
    render(<SlideDeck />);
    const dot = screen.getByTestId('slide-dot-0');
    expect(dot.style.background).toMatch(/255,\s*255,\s*255/);
  });

  it('uses dark dots when on the Settings slide in light theme mode', () => {
    render(<SlideDeck themeMode="light" />);
    // Advance to settings (index 3 with 4 visible slides).
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    expect(
      screen.getByTestId('slide-deck').getAttribute('data-current-slide-id'),
    ).toBe('settings');
    const dot = screen.getByTestId('slide-dot-0');
    expect(dot.style.background).toMatch(/15,\s*23,\s*42/);
  });

  it('keeps light dots on the Settings slide in dark theme mode', () => {
    render(<SlideDeck themeMode="dark" />);
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    fireEvent.click(screen.getByTestId('slide-deck-arrow-next'));
    const dot = screen.getByTestId('slide-dot-0');
    expect(dot.style.background).toMatch(/255,\s*255,\s*255/);
  });
});
