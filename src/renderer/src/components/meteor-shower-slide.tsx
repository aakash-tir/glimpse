// Meteor shower event slide. Plan/slides.md § Special events — meteor
// shower. Implementation lands in the next subtask; this stub only
// scaffolds the shell so the deck-level dispatch typechecks.

import type { MeteorEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

export type MeteorShowerSlideProps = {
  event: MeteorEvent;
};

export function MeteorShowerSlide({
  event,
}: MeteorShowerSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  return (
    <EventSlideShell
      title={`${event.shower.name} meteor shower`}
      isTomorrow={isTomorrow}
      testIdToken="meteor-shower"
    >
      <span data-testid="meteor-placeholder">Meteor content TBD</span>
    </EventSlideShell>
  );
}
