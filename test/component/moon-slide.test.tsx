import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { MoonPhase, MoonPhaseName } from '../../src/shared/astro';
import {
  MoonSlide,
  moonPhasePath,
} from '../../src/renderer/src/components/moon-slide';

afterEach(cleanup);

function buildPhase(
  phase: number,
  name: MoonPhaseName,
  illumination: number,
): MoonPhase {
  return { phase, name, illumination };
}

describe('MoonSlide — loading skeleton', () => {
  it('renders the loading skeleton when phase is null', () => {
    render(<MoonSlide phase={null} />);
    expect(screen.queryByTestId('slide-moon-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('slide-moon-shell')).toBeInTheDocument();
  });

  it('keeps the "Moon" title visible during the loading skeleton', () => {
    render(<MoonSlide phase={null} />);
    expect(screen.getByTestId('slide-title')).toHaveTextContent('Moon');
  });
});

describe('MoonSlide — rendering with mocked phase data', () => {
  it('renders the SVG moon graphic, phase label, and illumination %', () => {
    render(<MoonSlide phase={buildPhase(0.5, 'full-moon', 1.0)} />);
    expect(screen.getByTestId('moon-svg')).toBeInTheDocument();
    expect(screen.getByTestId('moon-phase-label')).toHaveTextContent(
      'Full Moon',
    );
    expect(screen.getByTestId('moon-illumination')).toHaveTextContent(
      '100% illuminated',
    );
  });

  it('rounds illumination % for display (0.7361 → 74%)', () => {
    render(<MoonSlide phase={buildPhase(0.4, 'waxing-gibbous', 0.7361)} />);
    expect(screen.getByTestId('moon-illumination')).toHaveTextContent(
      '74% illuminated',
    );
  });

  it('humanizes each phase name', () => {
    const cases: Array<[MoonPhaseName, string]> = [
      ['new-moon', 'New Moon'],
      ['waxing-crescent', 'Waxing Crescent'],
      ['first-quarter', 'First Quarter'],
      ['waxing-gibbous', 'Waxing Gibbous'],
      ['full-moon', 'Full Moon'],
      ['waning-gibbous', 'Waning Gibbous'],
      ['last-quarter', 'Last Quarter'],
      ['waning-crescent', 'Waning Crescent'],
    ];
    for (const [name, label] of cases) {
      const { unmount } = render(<MoonSlide phase={buildPhase(0, name, 0)} />);
      expect(screen.getByTestId('moon-phase-label')).toHaveTextContent(label);
      unmount();
    }
  });

  it('exposes the phase name + numeric value as data attributes for visual diff testing', () => {
    render(<MoonSlide phase={buildPhase(0.25, 'first-quarter', 0.5)} />);
    const content = screen.getByTestId('slide-moon-content');
    expect(content.getAttribute('data-phase-name')).toBe('first-quarter');
    expect(content.getAttribute('data-phase-value')).toBe('0.25');
    expect(content.getAttribute('data-illumination')).toBe('0.5');
  });

  it('omits the lit-region path at exact new moon (only the unlit disc shows)', () => {
    render(<MoonSlide phase={buildPhase(0, 'new-moon', 0)} />);
    expect(screen.queryByTestId('moon-lit-path')).not.toBeInTheDocument();
  });

  it('renders the lit-region path for any non-new phase', () => {
    render(<MoonSlide phase={buildPhase(0.5, 'full-moon', 1.0)} />);
    expect(screen.getByTestId('moon-lit-path')).toBeInTheDocument();
  });
});

describe('moonPhasePath — math', () => {
  it('returns null at exact new moon', () => {
    expect(moonPhasePath(0)).toBeNull();
    expect(moonPhasePath(1)).toBeNull();
  });

  it('uses the right semicircle (sweep=1) for waxing phases (0 < p < 0.5)', () => {
    const path = moonPhasePath(0.125)!;
    expect(path).toMatch(/^M 0 -50/);
    // First arc command: outer semicircle, sweep flag = 1 (right side).
    expect(path).toMatch(/A 50 50 0 0 1 0 50/);
  });

  it('uses the left semicircle (sweep=0) for waning phases (0.5 < p < 1)', () => {
    const path = moonPhasePath(0.875)!;
    expect(path).toMatch(/A 50 50 0 0 0 0 50/);
  });

  it('terminator is a flat line at first quarter (rx ≈ 0)', () => {
    const path = moonPhasePath(0.25)!;
    // Terminator's rx should be effectively zero (round to 4 decimals).
    expect(path).toMatch(/A 0\.0000 50 0 0 [01] 0 -50/);
  });

  it('terminator bulges toward the lit edge during crescent (sweep=1)', () => {
    // Waxing crescent — lit on the right, terminator should bulge right.
    const path = moonPhasePath(0.125)!;
    expect(path).toMatch(/A [\d.]+ 50 0 0 1 0 -50/);
  });

  it('terminator bulges away from the lit edge during gibbous (sweep=0)', () => {
    // Waxing gibbous — terminator should bulge left.
    const path = moonPhasePath(0.375)!;
    expect(path).toMatch(/A [\d.]+ 50 0 0 0 0 -50/);
  });

  it('produces a (near-)full disc at full moon', () => {
    const path = moonPhasePath(0.5)!;
    // |cos(π)| = 1, so terminator radius ≈ 50.
    expect(path).toMatch(/A 50\.0000 50 0 0 0 0 -50/);
  });

  it('normalizes phase values outside [0, 1)', () => {
    // 1.25 should behave the same as 0.25 (first quarter).
    const a = moonPhasePath(0.25);
    const b = moonPhasePath(1.25);
    expect(b).toBe(a);
  });
});
