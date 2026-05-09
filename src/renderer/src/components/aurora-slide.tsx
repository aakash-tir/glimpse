// Aurora event slide. Plan/slides.md § Special events — aurora.
// Implementation lands in the next subtask; this stub only scaffolds
// the shell so the deck-level dispatch typechecks.

import type { TimeFormat } from '../../../shared/settings-store';
import type { AuroraEvent } from '../../../shared/special-events';
import { EventSlideShell } from './event-slide-shell';

export type AuroraSlideProps = {
  event: AuroraEvent;
  timeFormat: TimeFormat;
  lastUpdated: string | null;
};

export function AuroraSlide({ event }: AuroraSlideProps): JSX.Element {
  // Aurora is today-only — its dayOffset type is fixed to 0 by the
  // SpecialEvent union, so the Tomorrow badge never applies.
  return (
    <EventSlideShell title="Aurora" isTomorrow={false} testIdToken="aurora">
      <span data-testid="aurora-placeholder" data-kp={String(event.kp)}>
        Aurora content TBD
      </span>
    </EventSlideShell>
  );
}
