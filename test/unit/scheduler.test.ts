import { describe, it, expect, vi } from 'vitest';
import {
  msUntilNextTick,
  TickScheduler,
  TICK_OFFSET_MIN,
} from '../../src/shared/scheduler';

function at(iso: string): Date {
  return new Date(iso);
}

describe('msUntilNextTick', () => {
  it('returns 5 minutes at the top of the hour (HH:00:00)', () => {
    expect(msUntilNextTick(at('2026-05-03T14:00:00.000Z'))).toBe(5 * 60 * 1000);
  });

  it('returns one full hour at exactly :05:00.000 (avoids busy-loop)', () => {
    // Re-entrant safety: if we land exactly on the tick instant we
    // schedule the NEXT one a full hour out instead of returning 0.
    expect(msUntilNextTick(at('2026-05-03T14:05:00.000Z'))).toBe(
      60 * 60 * 1000,
    );
  });

  it('returns 55 minutes at HH:10:00', () => {
    expect(msUntilNextTick(at('2026-05-03T14:10:00.000Z'))).toBe(
      55 * 60 * 1000,
    );
  });

  it('returns 6 minutes at HH:59:00', () => {
    expect(msUntilNextTick(at('2026-05-03T14:59:00.000Z'))).toBe(6 * 60 * 1000);
  });

  it('rolls over midnight correctly (23:55:00 → 00:05:00 next day)', () => {
    expect(msUntilNextTick(at('2026-05-03T23:55:00.000Z'))).toBe(
      10 * 60 * 1000,
    );
  });

  it('rolls over midnight at HH:05:00.000 too (23:05 → 00:05 next day)', () => {
    expect(msUntilNextTick(at('2026-05-03T23:05:00.000Z'))).toBe(
      60 * 60 * 1000,
    );
  });

  it('TICK_OFFSET_MIN equals 5 (matches the spec)', () => {
    expect(TICK_OFFSET_MIN).toBe(5);
  });
});

// Stub timer harness — we don't use vi.useFakeTimers because the
// scheduler accepts a setTimer/clearTimer pair and we want explicit
// control over which timer fires when.
type StubTimer = {
  id: number;
  cb: () => void;
  delay: number;
  cancelled: boolean;
};

function makeHarness(initialIso: string): {
  now: () => Date;
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  advance(ms: number): void;
  fireLatest(): void;
  setNow(iso: string): void;
  timers(): StubTimer[];
} {
  let nowDate = new Date(initialIso);
  let nextId = 1;
  const all: StubTimer[] = [];
  return {
    now: () => new Date(nowDate.getTime()),
    setTimer: (cb, delay) => {
      const t: StubTimer = { id: nextId++, cb, delay, cancelled: false };
      all.push(t);
      return t.id;
    },
    clearTimer: (handle) => {
      const t = all.find((x) => x.id === handle);
      if (t) t.cancelled = true;
    },
    advance: (ms) => {
      nowDate = new Date(nowDate.getTime() + ms);
    },
    fireLatest: () => {
      // Fire the most recent live timer (single-outstanding-timer
      // invariant in TickScheduler).
      const live = all.filter((t) => !t.cancelled);
      const last = live[live.length - 1];
      if (!last) throw new Error('no live timer to fire');
      last.cancelled = true;
      last.cb();
    },
    setNow: (iso) => {
      nowDate = new Date(iso);
    },
    timers: () => all,
  };
}

describe('TickScheduler — basic schedule', () => {
  it('schedules the first tick at the next :05 after start()', () => {
    const h = makeHarness('2026-05-03T14:10:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    const live = h.timers().filter((t) => !t.cancelled);
    expect(live.length).toBe(1);
    expect(live[0]!.delay).toBe(55 * 60 * 1000);
  });

  it('after the first tick fires, reschedules from "now" (not previous + 1h)', async () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    // Advance to the scheduled fire instant (14:05) and trigger.
    h.advance(5 * 60 * 1000);
    h.fireLatest();
    await Promise.resolve();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(1);
    // Next timer should be ~1 hour out (we're at exactly :05 → schedule
    // a full hour ahead per msUntilNextTick).
    const live = h.timers().filter((t) => !t.cancelled);
    expect(live.length).toBe(1);
    expect(live[0]!.delay).toBe(60 * 60 * 1000);
  });

  it('stop() cancels the outstanding timer and prevents further fires', () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    sched.stop();
    const live = h.timers().filter((t) => !t.cancelled);
    expect(live.length).toBe(0);
    expect(onTick).not.toHaveBeenCalled();
  });
});

describe('TickScheduler — sleep / wake', () => {
  it('notifyResume fires immediately if a tick window was missed', async () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    // Fire the initial 14:05 tick.
    h.advance(5 * 60 * 1000);
    h.fireLatest();
    await Promise.resolve();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(1);

    // Simulate the laptop sleeping for 3 hours. The scheduled timer
    // would have been due at 15:05, 16:05, 17:05 — but setTimeout
    // didn't fire because the system was asleep.
    h.advance(3 * 60 * 60 * 1000);
    sched.notifyResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(2);

    // The next regularly-scheduled tick is intact — single timer
    // outstanding, aligned to the next :05.
    const live = h.timers().filter((t) => !t.cancelled);
    expect(live.length).toBe(1);
  });

  it('notifyResume is a no-op when no tick window was missed', async () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    h.advance(5 * 60 * 1000);
    h.fireLatest();
    await Promise.resolve();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(1);

    // Brief sleep — only 30 minutes. No tick missed.
    h.advance(30 * 60 * 1000);
    sched.notifyResume();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('notifyResume before the first tick treats the gap as missed', async () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    // Sleep before the initial tick — 2 hours.
    h.advance(2 * 60 * 60 * 1000);
    sched.notifyResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('notifyResume after stop() does nothing', async () => {
    const h = makeHarness('2026-05-03T14:00:00.000Z');
    const onTick = vi.fn();
    const sched = new TickScheduler(onTick, {
      now: h.now,
      setTimer: h.setTimer,
      clearTimer: h.clearTimer,
    });
    sched.start();
    sched.stop();
    h.advance(3 * 60 * 60 * 1000);
    sched.notifyResume();
    await Promise.resolve();
    expect(onTick).not.toHaveBeenCalled();
  });
});
