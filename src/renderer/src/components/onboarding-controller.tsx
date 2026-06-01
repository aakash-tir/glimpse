// Drives the first-launch tutorial: walks the step machine, renders the
// Coachmark for the current step over a spotlit mock element, and
// reports completion / skip to main (which persists onboardingCompleted
// and transitions the window out of the onboarding panel).
//
// Skip and "Done" on the last step both call onboardingFinish; an app
// close mid-tutorial simply unmounts without calling it, so the next
// launch restarts from step 1 (see plan/onboarding.md § Behavior).
//
// Gestures are demonstrated on the mocks (OnboardingMock) — performing
// the taught gesture calls onGesture, which advances the step — with an
// animated cursor on the slides / switch / drag / resize steps.

import { useLayoutEffect, useRef, useState } from 'react';
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  isLastStep,
  nextStepIndex,
  type OnboardingFinishReason,
  type OnboardingStepId,
} from '../../../shared/onboarding';
import type { SpotlightRect } from '../../../shared/onboarding-window';
import { Coachmark } from './coachmark';
import {
  AnimatedCursor,
  OnboardingMock,
  type CursorGesture,
} from './onboarding-mocks';

export type OnboardingControllerProps = {
  /** Called after the tutorial reports completion / skip to main, so
   * the App can swap back to the normal icon / window view. The reason
   * lets the App land a completion on the Settings slide + toast. */
  onFinish: (reason: OnboardingFinishReason) => void;
};

function frac(
  w: number,
  h: number,
  fx: number,
  fy: number,
  fw: number,
  fh: number,
): SpotlightRect {
  return { x: w * fx, y: h * fy, width: w * fw, height: h * fh };
}

// Where each step's mock sits within the panel (fractions of panel
// size). offline + settings have no mock → no spotlight (full dim).
function spotlightFor(
  id: OnboardingStepId,
  w: number,
  h: number,
): SpotlightRect | null {
  switch (id) {
    case 'welcome':
      return frac(w, h, 0.36, 0.34, 0.28, 0.28);
    case 'slides':
      return frac(w, h, 0.1, 0.42, 0.8, 0.16);
    case 'switch':
    case 'minimize':
      return frac(w, h, 0.16, 0.28, 0.68, 0.42);
    case 'drag':
      return frac(w, h, 0.25, 0.3, 0.5, 0.4);
    case 'resize':
      return frac(w, h, 0.2, 0.28, 0.6, 0.44);
    case 'offline':
      return frac(w, h, 0.34, 0.32, 0.32, 0.3);
    default:
      return null;
  }
}

// Animated-cursor gesture per step (spec: slides, switch, drag, resize).
function cursorFor(id: OnboardingStepId): CursorGesture | null {
  switch (id) {
    case 'slides':
    case 'switch':
      return 'click';
    case 'drag':
      return 'double-click';
    case 'resize':
      return 'drag';
    default:
      return null;
  }
}

export function OnboardingController({
  onFinish,
}: OnboardingControllerProps): JSX.Element {
  const [stepIndex, setStepIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = (): void =>
      setSize({ w: root.clientWidth, h: root.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const step = ONBOARDING_STEPS[stepIndex]!;

  const finish = (reason: OnboardingFinishReason): void => {
    void window.glimpse?.onboardingFinish(reason);
    onFinish(reason);
  };

  const handleNext = (): void => {
    if (isLastStep(stepIndex)) {
      finish('complete');
      return;
    }
    setStepIndex((i) => nextStepIndex(i));
  };

  const spotlight = spotlightFor(step.id, size.w, size.h);
  const gesture = cursorFor(step.id);
  const mock =
    spotlight !== null ? (
      <OnboardingMock stepId={step.id} onGesture={handleNext} />
    ) : undefined;

  return (
    <div
      ref={rootRef}
      data-testid="onboarding-controller"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Coachmark
        spotlight={spotlight}
        spotlightContent={mock}
        title={step.title}
        description={step.description}
        stepIndex={stepIndex}
        stepCount={ONBOARDING_STEP_COUNT}
        onNext={handleNext}
        onSkip={() => finish('skip')}
        nextLabel={isLastStep(stepIndex) ? 'Done' : 'Next'}
      >
        {gesture ? <AnimatedCursor gesture={gesture} /> : null}
      </Coachmark>
    </div>
  );
}
