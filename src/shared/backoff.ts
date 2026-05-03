// Exponential backoff for the weather-fetch retry loop.
//
// Sequence per plan/data-sources.md:
//   attempt 0 → 5 min
//   attempt 1 → 10 min
//   attempt 2 → 20 min
//   attempt 3 → 40 min
//   attempt 4+ → 60 min (capped at 1 h)
//
// Resetting on success is the caller's responsibility: drop the attempt
// counter back to 0 after a successful fetch and the next failure starts
// at 5 min again.

export const BACKOFF_BASE_MIN = 5;
export const BACKOFF_CAP_MIN = 60;

export function backoffMinutesForAttempt(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt < 0) return BACKOFF_BASE_MIN;
  const raw = BACKOFF_BASE_MIN * 2 ** Math.floor(attempt);
  return Math.min(raw, BACKOFF_CAP_MIN);
}
