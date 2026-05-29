import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  isLastStep,
  nextStepIndex,
} from '../../src/shared/onboarding';

describe('onboarding step machine', () => {
  it('has 8 steps in the spec order', () => {
    expect(ONBOARDING_STEP_COUNT).toBe(8);
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'slides',
      'switch',
      'drag',
      'minimize',
      'resize',
      'offline',
      'settings',
    ]);
  });

  it('uses two-line copy only on drag, resize and offline', () => {
    const twoLine = ONBOARDING_STEPS.filter(
      (s) => s.description.length === 2,
    ).map((s) => s.id);
    expect(twoLine).toEqual(['drag', 'resize', 'offline']);
  });

  it('shows the title bar only on the switch and minimize steps', () => {
    const withBar = ONBOARDING_STEPS.filter((s) => s.showsTitleBar).map(
      (s) => s.id,
    );
    expect(withBar).toEqual(['switch', 'minimize']);
  });

  it('isLastStep is true only for the final index', () => {
    expect(isLastStep(ONBOARDING_STEP_COUNT - 1)).toBe(true);
    expect(isLastStep(ONBOARDING_STEP_COUNT - 2)).toBe(false);
    expect(isLastStep(0)).toBe(false);
  });

  it('nextStepIndex advances and clamps at the last step', () => {
    expect(nextStepIndex(0)).toBe(1);
    expect(nextStepIndex(ONBOARDING_STEP_COUNT - 2)).toBe(
      ONBOARDING_STEP_COUNT - 1,
    );
    expect(nextStepIndex(ONBOARDING_STEP_COUNT - 1)).toBe(
      ONBOARDING_STEP_COUNT - 1,
    );
  });
});
