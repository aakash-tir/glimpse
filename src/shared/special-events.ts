// Special-events activation logic. Pure module — given today's local
// date, the user's location + current Kp, the bundled meteor + eclipse
// catalogs, returns the ordered list of events that should produce
// slides today.
//
// Rules (plan/slides.md § Slide 5):
//   - An event is "active" if its peak date is today or calendar-
//     tomorrow in the user's local timezone.
//   - Aurora is active when (latitude, kp) crosses the visibility
//     threshold (see aurora.ts). Aurora has no future date — it's
//     today-only when active.
//   - A total lunar eclipse generates BOTH an eclipse event AND a
//     separate blood-moon event for the same date.
//   - Full moon is NEVER a special event (handled by not generating
//     full-moon events here).
//   - One slide per active event.
//   - Ordering: today first, then tomorrow; within each day,
//     alphabetical by event type ('aurora' < 'blood-moon' < 'eclipse'
//     < 'meteor').
//
// The events-hidden sticky flag (NOAA failure → suppress events slide
// for the session) is applied by the caller, not here, so this module
// stays a pure transform.

import { evaluateAuroraVisibility } from './aurora';
import { isBloodMoonEclipse, type Eclipse } from './eclipses';
import type { MeteorShower } from './meteor-showers';

export type SpecialEventType = 'aurora' | 'meteor' | 'eclipse' | 'blood-moon';

/** 0 = today, 1 = tomorrow. */
export type DayOffset = 0 | 1;

export type AuroraEvent = {
  type: 'aurora';
  /** Unique slide id. */
  id: string;
  dayOffset: 0;
  kp: number;
  latitude: number;
  /** Visibility text for the slide body — wraps evaluateAuroraVisibility. */
  visibilityText: string;
};

export type MeteorEvent = {
  type: 'meteor';
  id: string;
  dayOffset: DayOffset;
  shower: MeteorShower;
};

export type EclipseEvent = {
  type: 'eclipse';
  id: string;
  dayOffset: DayOffset;
  eclipse: Eclipse;
};

export type BloodMoonEvent = {
  type: 'blood-moon';
  id: string;
  dayOffset: DayOffset;
  eclipse: Eclipse;
};

export type SpecialEvent =
  | AuroraEvent
  | MeteorEvent
  | EclipseEvent
  | BloodMoonEvent;

export type ComputeEventsInput = {
  /** Local "today" as YYYY-MM-DD in the user's wall clock. */
  todayLocal: string;
  /** Local "tomorrow" as YYYY-MM-DD in the user's wall clock. */
  tomorrowLocal: string;
  /** User latitude (signed degrees). null disables aurora detection. */
  latitude: number | null;
  /** Latest Kp from NOAA. null disables aurora detection. */
  kp: number | null;
  meteorShowers: readonly MeteorShower[];
  eclipses: readonly Eclipse[];
};

const TYPE_ORDER: Record<SpecialEventType, number> = {
  aurora: 0,
  'blood-moon': 1,
  eclipse: 2,
  meteor: 3,
};

/**
 * Compute today's wall-clock date as YYYY-MM-DD. Helper for callers in
 * the renderer / main process that just want to feed the result into
 * computeActiveEvents.
 */
export function localYmd(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** YYYY-MM-DD for the day after the given date, in local wall-clock. */
export function localTomorrowYmd(date: Date): string {
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  );
  return localYmd(next);
}

export function computeActiveEvents(input: ComputeEventsInput): SpecialEvent[] {
  const events: SpecialEvent[] = [];

  // Aurora — today-only. Requires both latitude and Kp.
  if (input.latitude !== null && input.kp !== null) {
    const aurora = evaluateAuroraVisibility({
      latitude: input.latitude,
      kp: input.kp,
    });
    if (aurora.visibleFromUserLocation) {
      events.push({
        type: 'aurora',
        id: 'event:aurora',
        dayOffset: 0,
        kp: input.kp,
        latitude: input.latitude,
        visibilityText: aurora.text,
      });
    }
  }

  // Meteor showers — today or tomorrow.
  for (const shower of input.meteorShowers) {
    const offset = dayOffsetFor(
      shower.peakDate,
      input.todayLocal,
      input.tomorrowLocal,
    );
    if (offset === null) continue;
    events.push({
      type: 'meteor',
      id: `event:meteor:${shower.name}`,
      dayOffset: offset,
      shower,
    });
  }

  // Eclipses — today or tomorrow. Total lunar eclipses generate BOTH
  // an eclipse event and a blood-moon event for the same date.
  for (const eclipse of input.eclipses) {
    const offset = dayOffsetFor(
      eclipse.date,
      input.todayLocal,
      input.tomorrowLocal,
    );
    if (offset === null) continue;
    events.push({
      type: 'eclipse',
      id: `event:eclipse:${eclipse.date}`,
      dayOffset: offset,
      eclipse,
    });
    if (isBloodMoonEclipse(eclipse)) {
      events.push({
        type: 'blood-moon',
        id: `event:blood-moon:${eclipse.date}`,
        dayOffset: offset,
        eclipse,
      });
    }
  }

  // Order: today first, then tomorrow; within each day alphabetical
  // by event type per TYPE_ORDER. Stable sort preserves source order
  // within the same (day, type) bucket — useful for deterministic
  // ordering when (theoretically) two meteor showers peak on the same
  // day.
  events.sort((a, b) => {
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return events;
}

function dayOffsetFor(
  peakDateYmd: string,
  todayLocal: string,
  tomorrowLocal: string,
): DayOffset | null {
  if (peakDateYmd === todayLocal) return 0;
  if (peakDateYmd === tomorrowLocal) return 1;
  return null;
}
