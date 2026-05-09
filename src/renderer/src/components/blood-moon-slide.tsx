// Blood moon event slide. Plan/slides.md § Special events — blood moon.
// Implementation lands in the next subtask; this stub only scaffolds
// the shell so the deck-level dispatch typechecks.

import type { TimeFormat } from '../../../shared/settings-store';
import type { BloodMoonEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

export type BloodMoonSlideProps = {
  event: BloodMoonEvent;
  timeFormat: TimeFormat;
};

export function BloodMoonSlide({ event }: BloodMoonSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  return (
    <EventSlideShell
      title="Blood moon"
      isTomorrow={isTomorrow}
      testIdToken="blood-moon"
    >
      <span data-testid="blood-moon-placeholder">Blood moon content TBD</span>
    </EventSlideShell>
  );
}
