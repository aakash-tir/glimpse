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
