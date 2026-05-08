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

  it('reports a radial curve via data-curve', () => {
    render(<EdgeFade side="right" visible />);
    expect(
      screen.getByTestId('edge-fade-right').getAttribute('data-curve'),
    ).toBe('radial');
  });

  it('renders a radial gradient (not linear) so iso-alpha lines arc inward', () => {
    render(<EdgeFade side="right" visible />);
    const bg = screen.getByTestId('edge-fade-right').style.background;
    expect(bg).toContain('radial-gradient');
    expect(bg).not.toContain('linear-gradient');
  });

  it('anchors the radial origin at the panel edge midpoint per side', () => {
    const { rerender } = render(<EdgeFade side="right" visible />);
    let bg = screen.getByTestId('edge-fade-right').style.background;
    // Right side → origin at 100% 50%.
    expect(bg).toMatch(/at\s+100%\s+50%/);

    rerender(<EdgeFade side="left" visible />);
    bg = screen.getByTestId('edge-fade-left').style.background;
    // Left side → origin at 0% 50%.
    expect(bg).toMatch(/at\s+0%\s+50%/);
  });

  it('sizes the ellipse so the boundary traces a parenthesis curve (horiz=strip width, vert=½ slide height)', () => {
    render(<EdgeFade side="right" visible />);
    const bg = screen.getByTestId('edge-fade-right').style.background;
    // ellipse 100% × 50% — horizontal radius matches the strip width
    // (boundary touches inner edge at the middle); vertical radius is
    // half the strip height (boundary touches panel edge at corners).
    expect(bg).toMatch(/ellipse\s+100%\s+50%/);
  });

  it('peaks at the target alpha at 0% (panel edge) and fades to 0 at 100% (inner end)', () => {
    render(
      <EdgeFade side="right" visible fadeToColor="rgba(255, 255, 255, 0.4)" />,
    );
    const bg = screen.getByTestId('edge-fade-right').style.background;
    expect(bg).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.4\)\s*0%/);
    expect(bg).toMatch(/rgba\(255,\s*255,\s*255,\s*0\)\s*100%/);
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

  it('is pointer-events-none so it never intercepts scroll / click', () => {
    render(<EdgeFade side="right" visible />);
    expect(screen.getByTestId('edge-fade-right').style.pointerEvents).toBe(
      'none',
    );
  });
});
