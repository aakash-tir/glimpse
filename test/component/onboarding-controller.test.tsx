import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OnboardingController } from '../../src/renderer/src/components/onboarding-controller';
import { ONBOARDING_STEP_COUNT } from '../../src/shared/onboarding';

type Stub = { onboardingFinish: ReturnType<typeof vi.fn> };
const onboardingFinish = vi.fn();

beforeEach(() => {
  onboardingFinish.mockReset();
  (window as unknown as { glimpse: Stub }).glimpse = { onboardingFinish };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { glimpse?: unknown }).glimpse;
});

function next(): void {
  fireEvent.click(screen.getByTestId('coachmark-next'));
}

describe('OnboardingController', () => {
  it('starts on the welcome step', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Welcome to Glimpse',
    );
    expect(
      screen.getByTestId('coachmark').getAttribute('data-step-index'),
    ).toBe('0');
  });

  it('Next advances to the following step', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    next();
    expect(
      screen.getByTestId('coachmark').getAttribute('data-step-index'),
    ).toBe('1');
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Slide navigation',
    );
  });

  it('Skip reports skip and hands back to the App', () => {
    const onFinish = vi.fn();
    render(<OnboardingController onFinish={onFinish} />);
    fireEvent.click(screen.getByTestId('coachmark-skip'));
    expect(onboardingFinish).toHaveBeenCalledWith('skip');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('Done on the last step reports complete', () => {
    const onFinish = vi.fn();
    render(<OnboardingController onFinish={onFinish} />);
    // Walk to the last step, then click "Done".
    for (let i = 0; i < ONBOARDING_STEP_COUNT - 1; i++) next();
    expect(screen.getByTestId('coachmark-next').textContent).toBe('Done');
    next();
    expect(onboardingFinish).toHaveBeenCalledWith('complete');
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('interrupt (unmount) does NOT report completion', () => {
    const { unmount } = render(<OnboardingController onFinish={vi.fn()} />);
    unmount();
    expect(onboardingFinish).not.toHaveBeenCalled();
  });
});

function stepIndex(): string | null {
  return screen.getByTestId('coachmark').getAttribute('data-step-index');
}

describe('OnboardingController — mocks & gestures', () => {
  it('welcome shows the mock icon; clicking it advances', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mock-icon'));
    expect(stepIndex()).toBe('1');
  });

  it('slides step: clicking a mock arrow advances the step', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    next(); // → slides
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Slide navigation',
    );
    fireEvent.click(screen.getByTestId('mock-arrow-right'));
    expect(stepIndex()).toBe('2');
  });

  it('shows the mock title bar on the switch and minimize steps only', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    next();
    next(); // → switch (index 2)
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Icon and window',
    );
    expect(screen.getByTestId('mock-title-bar')).toBeInTheDocument();
    next(); // → drag (index 3): no title bar
    expect(screen.queryByTestId('mock-title-bar')).toBeNull();
    next(); // → minimize (index 4)
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Minimize button',
    );
    expect(screen.getByTestId('mock-title-bar')).toBeInTheDocument();
  });

  it('offline step shows a static sad-cloud and the two-line copy', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    for (let i = 0; i < 6; i++) next(); // → offline (index 6)
    expect(screen.getByTestId('coachmark-title').textContent).toBe(
      'Offline state',
    );
    // The sample sad-cloud lives inside the overlay (no live icon view
    // exists during onboarding).
    expect(screen.getByTestId('icon-sad-cloud')).toBeInTheDocument();
    expect(screen.getByText(/sad cloud/i)).toBeInTheDocument();
    expect(screen.getByText(/keeps retrying/i)).toBeInTheDocument();
  });

  it('renders the animated cursor on gesture steps but not on welcome', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    expect(screen.queryByTestId('onboarding-cursor')).toBeNull(); // welcome
    next(); // slides
    expect(
      screen.getByTestId('onboarding-cursor').getAttribute('data-gesture'),
    ).toBe('click');
    next();
    next(); // → drag
    expect(
      screen.getByTestId('onboarding-cursor').getAttribute('data-gesture'),
    ).toBe('double-click');
  });
});

describe('OnboardingController — keyboard operation', () => {
  // plan/onboarding.md § Keyboard & focus.
  it('walks the entire tutorial with the keyboard alone', () => {
    const onFinish = vi.fn();
    render(<OnboardingController onFinish={onFinish} />);

    // Focus starts on Next, so Enter advances without any mouse use.
    for (let i = 0; i < ONBOARDING_STEP_COUNT - 1; i++) {
      expect(
        screen.getByTestId('coachmark').getAttribute('data-step-index'),
      ).toBe(String(i));
      expect(document.activeElement).toBe(screen.getByTestId('coachmark-next'));
      fireEvent.click(document.activeElement!);
    }
    // Final step completes.
    expect(screen.getByTestId('coachmark-next').textContent).toBe('Done');
    fireEvent.click(screen.getByTestId('coachmark-next'));
    expect(onboardingFinish).toHaveBeenCalledWith('complete');
    expect(onFinish).toHaveBeenCalledWith('complete');
  });

  it('Escape ends the run as a skip, not an interrupt', () => {
    const onFinish = vi.fn();
    render(<OnboardingController onFinish={onFinish} />);
    next();
    fireEvent.keyDown(screen.getByTestId('coachmark'), { key: 'Escape' });
    // 'skip' is what persists onboardingCompleted = true; an interrupt
    // never calls onboardingFinish at all.
    expect(onboardingFinish).toHaveBeenCalledWith('skip');
    expect(onFinish).toHaveBeenCalledWith('skip');
  });

  it('returns focus to Next after a gesture advances the step', () => {
    render(<OnboardingController onFinish={vi.fn()} />);
    // A real click on the spotlit mock moves focus onto the mock, which
    // is what would otherwise strand the keyboard user on the next step.
    const mock = screen.getByTestId('mock-icon');
    mock.focus();
    expect(document.activeElement).toBe(mock);

    fireEvent.click(mock);

    // The gesture advanced the step...
    expect(
      screen.getByTestId('coachmark').getAttribute('data-step-index'),
    ).toBe('1');
    // ...and focus followed it back to the Next button.
    expect(document.activeElement).toBe(screen.getByTestId('coachmark-next'));
  });
});
