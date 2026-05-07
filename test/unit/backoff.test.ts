import { describe, it, expect } from 'vitest';
import {
  BACKOFF_BASE_MIN,
  BACKOFF_CAP_MIN,
  backoffMinutesForAttempt,
} from '../../src/shared/backoff';

describe('backoffMinutesForAttempt', () => {
  it('produces the documented 5 → 10 → 20 → 40 → 60 → 60 sequence', () => {
    expect(backoffMinutesForAttempt(0)).toBe(5);
    expect(backoffMinutesForAttempt(1)).toBe(10);
    expect(backoffMinutesForAttempt(2)).toBe(20);
    expect(backoffMinutesForAttempt(3)).toBe(40);
    expect(backoffMinutesForAttempt(4)).toBe(60);
    expect(backoffMinutesForAttempt(5)).toBe(60);
    expect(backoffMinutesForAttempt(6)).toBe(60);
  });

  it('caps far beyond the cap so a long failure run never spins up', () => {
    expect(backoffMinutesForAttempt(10)).toBe(BACKOFF_CAP_MIN);
    expect(backoffMinutesForAttempt(100)).toBe(BACKOFF_CAP_MIN);
  });

  it('treats an empty attempt counter (0) as the base delay', () => {
    expect(backoffMinutesForAttempt(0)).toBe(BACKOFF_BASE_MIN);
  });

  it('clamps invalid inputs to the base delay rather than throwing', () => {
    // Garbage inputs should produce the safest possible delay (the
    // base, not the cap), so callers that somehow lose track of their
    // attempt counter still retry promptly.
    expect(backoffMinutesForAttempt(-1)).toBe(BACKOFF_BASE_MIN);
    expect(backoffMinutesForAttempt(NaN)).toBe(BACKOFF_BASE_MIN);
    expect(backoffMinutesForAttempt(Infinity)).toBe(BACKOFF_BASE_MIN);
  });

  it('reset on success: attempt back to 0 returns to the 5 min base', () => {
    // Walk forward to the cap, then reset and verify the next call is
    // back at the base — the contract callers rely on after a successful
    // fetch.
    expect(backoffMinutesForAttempt(4)).toBe(60);
    expect(backoffMinutesForAttempt(0)).toBe(5);
  });
});
