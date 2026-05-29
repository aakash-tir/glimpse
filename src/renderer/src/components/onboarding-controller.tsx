// Drives the first-launch tutorial: walks the step machine, renders the
// Coachmark for the current step, and reports completion / skip to main
// (which persists onboardingCompleted and transitions the window out of
// the onboarding panel).
//
// Skip and "Done" on the last step both call onboardingFinish; an app
// close mid-tutorial simply unmounts without calling it, so the next
// launch restarts from step 1 (see plan/onboarding.md § Behavior).
//
// NOTE: spotlights / mock elements / animated cursor land in a later
// commit — this commit walks the deck with the dimmed callouts only.

import { useState } from 'react';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  isLastStep,
  nextStepIndex,
  type OnboardingFinishReason,
} from '../../../shared/onboarding';
import { Coachmark } from './coachmark';

export type OnboardingControllerProps = {
  /** Called after the tutorial reports completion / skip to main, so
   * the App can swap back to the normal icon / window view. */
  onFinish: () => void;
};

export function OnboardingController({
  onFinish,
}: OnboardingControllerProps): JSX.Element {
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex]!;

  const finish = (reason: OnboardingFinishReason): void => {
    void window.glimpse?.onboardingFinish(reason);
    onFinish();
  };

  const handleNext = (): void => {
    if (isLastStep(stepIndex)) {
      finish('complete');
      return;
    }
    setStepIndex((i) => nextStepIndex(i));
  };

  return (
    <div
      data-testid="onboarding-controller"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Coachmark
        spotlight={null}
        title={step.title}
        description={step.description}
        stepIndex={stepIndex}
        stepCount={ONBOARDING_STEP_COUNT}
        onNext={handleNext}
        onSkip={() => finish('skip')}
        nextLabel={isLastStep(stepIndex) ? 'Done' : 'Next'}
      />
    </div>
  );
}
