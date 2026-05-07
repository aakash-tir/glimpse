// Clock-aligned :05 scheduler used by the data layer.
//
// Fires once per wall-clock hour at HH:05:00. After a tick, the next
// fire is computed from `Date.now()` rather than `previous + 1h` so
// drift doesn't accumulate (and so a sleep/wake that delays a tick
// realigns to the next valid :05 instead of marching forward at the
// pre-sleep cadence).
//
// Sleep/wake handling: setTimeout in Electron can either fire late or
// be skipped entirely depending on the host OS power state. The
// scheduler relies on `powerMonitor.on('resume')` (wired in main) to
// call `notifyResume`. If at least one full tick window was missed
// while asleep, an immediate refresh fires and the schedule realigns.
//
// Per-tick delay override: the callback may return `{ nextDelayMs }`
// to ask for a non-default delay before the next tick. Used by the
// data layer to retry on the exponential backoff schedule (5 → 10 →
// 20 → 40 → 60 min) after a failed refresh. Returning `void` (the
// happy path) keeps the default :05 cadence.

export const TICK_OFFSET_MIN = 5;

// Pure: given a Date, returns the milliseconds until the next :05 of
// some hour. If `now` is before :05 of the current hour, that's the
// target. If `now` is at or after :05, the target is :05 of the
// following hour. At exactly :05:00.000 we deliberately schedule a
// full hour ahead so that re-entrant calls don't busy-loop.
export function msUntilNextTick(now: Date): number {
  const target = new Date(now.getTime());
  if (now.getMinutes() < TICK_OFFSET_MIN) {
    target.setHours(now.getHours(), TICK_OFFSET_MIN, 0, 0);
  } else {
    target.setHours(now.getHours() + 1, TICK_OFFSET_MIN, 0, 0);
  }
  return target.getTime() - now.getTime();
}

export type TickResult = { nextDelayMs: number } | void;
export type TickCallback = () => TickResult | Promise<TickResult>;

export type SchedulerDeps = {
  // Pluggable for tests — defaults to the host wall clock and host
  // setTimeout / clearTimeout.
  now?: () => Date;
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export class TickScheduler {
  private readonly onTick: TickCallback;
  private readonly now: () => Date;
  private readonly setTimer: (cb: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  private timer: unknown = null;
  // Wall-clock time of the most recent tick that actually fired —
  // either from the scheduled timer or from a notifyResume catch-up.
  // null until the first tick. Used by notifyResume to detect that a
  // tick window was missed while the system was asleep.
  private lastTickAt: Date | null = null;
  private running = false;

  constructor(onTick: TickCallback, deps: SchedulerDeps = {}) {
    this.onTick = onTick;
    this.now = deps.now ?? ((): Date => new Date());
    this.setTimer = deps.setTimer ?? ((cb, ms): unknown => setTimeout(cb, ms));
    this.clearTimer =
      deps.clearTimer ?? ((handle): void => clearTimeout(handle as never));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  // Call from the host's powerMonitor.on('resume') hook. If any tick
  // window was missed while asleep, fires onTick immediately and
  // reschedules. If no tick was missed, leaves the existing schedule
  // untouched.
  notifyResume(): void {
    if (!this.running) return;
    const now = this.now();
    if (this.shouldCatchUp(now)) {
      void this.fireTick(now);
    }
  }

  private shouldCatchUp(now: Date): boolean {
    // First-tick case (we started, then the system slept before the
    // initial schedule fired) — treat as missed, since the user
    // expects a fetch on resume.
    if (this.lastTickAt === null) return true;
    // A missed tick = more than one full hour has elapsed since the
    // last tick. Tolerance of 60s on the threshold avoids edge-of-tick
    // false positives if a resume fires exactly when a tick was due.
    const elapsedMs = now.getTime() - this.lastTickAt.getTime();
    return elapsedMs > 60 * 60 * 1000 + 60 * 1000;
  }

  private scheduleNext(overrideMs?: number): void {
    if (!this.running) return;
    const delay = overrideMs ?? msUntilNextTick(this.now());
    this.timer = this.setTimer(() => {
      void this.fireTick(this.now());
    }, delay);
  }

  private async fireTick(at: Date): Promise<void> {
    this.lastTickAt = at;
    // Invariant: only one outstanding timer at a time. Clear before
    // running the callback so a notifyResume mid-callback doesn't
    // fight the about-to-be-rescheduled timer.
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    let override: number | undefined;
    try {
      const result = await this.onTick();
      if (
        result &&
        typeof result === 'object' &&
        typeof result.nextDelayMs === 'number' &&
        result.nextDelayMs >= 0
      ) {
        override = result.nextDelayMs;
      }
    } finally {
      this.scheduleNext(override);
    }
  }
}
