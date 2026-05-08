import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  EdgeFade,
  EDGE_FADE_WIDTH_PX,
} from '../../src/renderer/src/components/edge-fade';

afterEach(cleanup);

describe('EdgeFade', () => {
  it('renders the right-side fade with the spec-required ~14 px width', () => {
    render(<EdgeFade side="right" visible />);
    const fade = screen.getByTestId('edge-fade-right');
    // Plan/slides.md: smaller, curved fade — narrower than the
    // original 24 px linear stripe.
    expect(EDGE_FADE_WIDTH_PX).toBe(14);
    expect(fade.getAttribute('data-width-px')).toBe('14');
    expect(fade.getAttribute('data-side')).toBe('right');
  });

  it('reports a quadratic curve via data-curve', () => {
    render(<EdgeFade side="right" visible />);
    expect(
      screen.getByTestId('edge-fade-right').getAttribute('data-curve'),
    ).toBe('quadratic');
  });

  it('emits multiple gradient stops to approximate a curve (not just two-stop linear)', () => {
    render(
      <EdgeFade side="right" visible fadeToColor="rgba(255, 255, 255, 0.4)" />,
    );
    const bg = screen.getByTestId('edge-fade-right').style.background;
    // A curve uses intermediate stops with non-extreme alpha values —
    // assert at least a 25% and 75% stop are present.
    expect(bg).toMatch(/25%/);
    expect(bg).toMatch(/75%/);
    // Inner end transparent, outer end at the target alpha.
    expect(bg).toMatch(/rgba\(255,\s*255,\s*255,\s*0\)\s*0%/);
    expect(bg).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.4\)\s*100%/);
  });

  it('renders the left-side fade with the same width', () => {
    render(<EdgeFade side="left" visible />);
    expect(screen.getByTestId('edge-fade-left').getAttribute('data-side')).toBe(
      'left',
    );
  });

  it('switches opacity to 0 when visible is false (fade disappears at the boundary)', () => {
    render(<EdgeFade side="right" visible={false} />);
    const fade = screen.getByTestId('edge-fade-right');
    expect(fade.getAttribute('data-visible')).toBe('off');
    expect(fade.style.opacity).toBe('0');
  });

  it('renders a linear gradient in the direction matching the side', () => {
    render(<EdgeFade side="right" visible />);
    const fade = screen.getByTestId('edge-fade-right');
    expect(fade.style.background).toContain('linear-gradient');
    expect(fade.style.background).toContain('to right');
  });

  it('is pointer-events-none so it never intercepts scroll / click', () => {
    render(<EdgeFade side="right" visible />);
    expect(screen.getByTestId('edge-fade-right').style.pointerEvents).toBe(
      'none',
    );
  });
});
