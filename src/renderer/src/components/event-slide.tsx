// Per-event slide router. Owns the dispatch from SpecialEvent → the
// right per-type component (AuroraSlide, MeteorShowerSlide,
// EclipseSlide, BloodMoonSlide). Each per-type component owns its own
// background motion (per plan/styling.md § Per-slide background motion)
// and the data formatting for its specific payload.
//
// The Tomorrow badge is a small reusable bit shared across all four
// event slide types — it's defined alongside the event components in
// event-slide-shell.tsx so each per-type component can drop it in
// without re-declaring the styling.

import type { SpecialEvent } from '../../../shared/special-events';
import type { TimeFormat } from '../../../shared/settings-store';
import { AuroraSlide } from './aurora-slide';
import { BloodMoonSlide } from './blood-moon-slide';
import { EclipseSlide } from './eclipse-slide';
import { MeteorShowerSlide } from './meteor-shower-slide';

export type EventSlideProps = {
  event: SpecialEvent;
  timeFormat: TimeFormat;
  /** Last successful data fetch — surfaced on the aurora slide. */
  lastUpdated: string | null;
  /** Forecast location's IANA zone — every clock time renders in it.
   * See plan/slides.md § Time rendering. */
  timeZone: string | null;
};

export function EventSlide({
  event,
  timeFormat,
  lastUpdated,
  timeZone,
}: EventSlideProps): JSX.Element {
  switch (event.type) {
    case 'aurora':
      return (
        <AuroraSlide
          event={event}
          timeFormat={timeFormat}
          lastUpdated={lastUpdated}
          timeZone={timeZone}
        />
      );
    case 'meteor':
      return <MeteorShowerSlide event={event} />;
    case 'eclipse':
      return (
        <EclipseSlide
          event={event}
          timeFormat={timeFormat}
          timeZone={timeZone}
        />
      );
    case 'blood-moon':
      return (
        <BloodMoonSlide
          event={event}
          timeFormat={timeFormat}
          timeZone={timeZone}
        />
      );
  }
}
