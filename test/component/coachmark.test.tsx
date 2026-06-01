import { type ComponentProps } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  Coachmark,
  COACHMARK_DIM_OPACITY,
  SPOTLIGHT_PAD_PX,
} from '../../src/renderer/src/components/coachmark';

afterEach(cleanup);

const SPOT = { x: 100, y: 40, width: 64, height: 64 };

function renderCoachmark(
  overrides: Partial<ComponentProps<typeof Coachmark>> = {},
) {
  const onNext = vi.fn();
  const onSkip = vi.fn();
  render(
    <Coachmark
      spotlight={SPOT}
      title="Slide navigation"
      description="Use the arrows to flip between slides."
      stepIndex={1}
      stepCount={8}
      onNext={onNext}
      onSkip={onSkip}
      {...overrides}
    />,
  );
  return { onNext, onSkip };
}

describe('Coachmark', () => {
  it('dims at 60% with an 8px-padded spotlight cut-out', () => {
    renderCoachmark();
    const spot = screen.getByTestId('coachmark-spotlight');
    expect(spot.getAttribute('data-spotlight-pad')).toBe(
      String(SPOTLIGHT_PAD_PX),
    );
    expect(SPOTLIGHT_PAD_PX).toBe(8);
    // Hole is expanded by the padding on every side.
    expect(spot.style.left).toBe(`${SPOT.x - SPOTLIGHT_PAD_PX}px`);
    expect(spot.style.width).toBe(`${SPOT.width + SPOTLIGHT_PAD_PX * 2}px`);
    // 60% dim via the box-shadow cut-out.
    expect(spot.style.boxShadow).toContain(String(COACHMARK_DIM_OPACITY));
  });

  it('renders a full 60% dim when there is no spotlight', () => {
    renderCoachmark({ spotlight: null });
    const dim = screen.getByTestId('coachmark-dim-full');
    expect(dim.style.background).toContain(String(COACHMARK_DIM_OPACITY));
    expect(screen.queryByTestId('coachmark-spotlight')).toBeNull();
  });

  it('renders the title and a two-line description', () => {
    renderCoachmark({
      title: 'Resize',
      description: ['Drag a corner to resize.', 'It is always a square.'],
    });
    expect(screen.getByTestId('coachmark-title').textContent).toBe('Resize');
    expect(screen.getByText('Drag a corner to resize.')).toBeInTheDocument();
    expect(screen.getByText('It is always a square.')).toBeInTheDocument();
  });

  it('renders one dot per step with the current one active', () => {
    renderCoachmark({ stepIndex: 2, stepCount: 8 });
    const dots = screen.getByTestId('coachmark-dots');
    expect(dots.getAttribute('data-step-count')).toBe('8');
    const children = Array.from(dots.children);
    expect(children).toHaveLength(8);
    expect(children[2]!.getAttribute('data-active')).toBe('on');
    expect(children[0]!.getAttribute('data-active')).toBe('off');
  });

  it('fires onNext and onSkip from the buttons', () => {
    const { onNext, onSkip } = renderCoachmark();
    fireEvent.click(screen.getByTestId('coachmark-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('coachmark-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('swallows backdrop clicks but lets the spotlit mock receive them', () => {
    const onMock = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <Coachmark
          spotlight={SPOT}
          spotlightContent={
            <button data-testid="mock-el" onClick={onMock}>
              icon
            </button>
          }
          title="Welcome"
          description="hi"
          stepIndex={0}
          stepCount={8}
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />
      </div>,
    );
    // Backdrop swallows: parent handler not reached.
    fireEvent.click(screen.getByTestId('coachmark-backdrop'));
    expect(onParent).not.toHaveBeenCalled();
    // Spotlit mock is interactive.
    fireEvent.click(screen.getByTestId('mock-el'));
    expect(onMock).toHaveBeenCalledTimes(1);
  });
});
