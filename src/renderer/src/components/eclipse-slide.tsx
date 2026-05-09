// Eclipse event slide. Plan/slides.md § Special events — eclipse.
// Implementation lands in the next subtask; this stub only scaffolds
// the shell so the deck-level dispatch typechecks.

import { eclipseTypeLabel } from '../../../shared/eclipses';
import type { TimeFormat } from '../../../shared/settings-store';
import type { EclipseEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

export type EclipseSlideProps = {
  event: EclipseEvent;
  timeFormat: TimeFormat;
};

export function EclipseSlide({ event }: EclipseSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  return (
    <EventSlideShell
      title={eclipseTypeLabel(event.eclipse.type)}
      isTomorrow={isTomorrow}
      testIdToken="eclipse"
    >
      <span data-testid="eclipse-placeholder">Eclipse content TBD</span>
    </EventSlideShell>
  );
}
