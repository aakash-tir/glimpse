// First-launch onboarding step machine. Pure data + helpers shared by
// the controller and tests. See plan/onboarding.md § Steps.
//
// Content is defined here (not in the component) so the step order,
// count, two-line copy and title-bar visibility are all unit-testable
// and there's a single source of truth for the deck.

export type OnboardingStepId =
  | 'welcome'
  | 'slides'
  | 'switch'
  | 'drag'
  | 'minimize'
  | 'resize'
  | 'offline'
  | 'settings';

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  /** One line, or two for the drag / resize / offline steps. */
  description: readonly string[];
  /** Steps that reveal the mock title bar (icon↔window and minimize). */
  showsTitleBar: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Glimpse',
    description: ['Click the icon to expand the window.'],
    showsTitleBar: false,
  },
  {
    id: 'slides',
    title: 'Slide navigation',
    description: ['Use the arrows to flip between slides.'],
    showsTitleBar: false,
  },
  {
    id: 'switch',
    title: 'Icon and window',
    description: [
      'Click the title-bar weather icon to collapse back to the icon, and the icon to expand again.',
    ],
    showsTitleBar: true,
  },
  {
    id: 'drag',
    title: 'Drag mode',
    description: [
      'Double-click the icon or window to enter drag mode and move it.',
      'Click anywhere outside to exit.',
    ],
    showsTitleBar: false,
  },
  {
    id: 'minimize',
    title: 'Minimize button',
    description: [
      'Collapses to the icon and resets it to the default top-right.',
    ],
    showsTitleBar: true,
  },
  {
    id: 'resize',
    title: 'Resize',
    description: [
      'Drag any of the four corner handles to resize the window.',
      'Width and height stay equal — it is always a square.',
    ],
    showsTitleBar: false,
  },
  {
    id: 'offline',
    title: 'Offline state',
    description: [
      "If Glimpse can't reach the weather service, the icon shows a sad cloud.",
      "While it's like this, clicking the icon won't open the window — Glimpse keeps retrying and recovers on its own.",
    ],
    showsTitleBar: false,
  },
  {
    id: 'settings',
    title: "You're all set",
    description: [
      'This is the Settings slide — change units, theme and more here.',
    ],
    showsTitleBar: false,
  },
];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export function isLastStep(index: number): boolean {
  return index >= ONBOARDING_STEP_COUNT - 1;
}

/** Clamp + advance; never runs past the last step. */
export function nextStepIndex(index: number): number {
  return Math.min(index + 1, ONBOARDING_STEP_COUNT - 1);
}

/** How the tutorial ended — drives whether onboardingCompleted is set. */
export type OnboardingFinishReason = 'complete' | 'skip';
