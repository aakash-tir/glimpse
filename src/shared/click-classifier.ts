// Disambiguates a single click from the first half of a double click.
//
// Per plan/icon.md, a double-click is registered when two clicks arrive
// within 250 ms of each other; otherwise the click is treated as a single
// click (which expands the icon to the window in M3, and is ignored while
// drag mode is active in M2).

export const DOUBLE_CLICK_THRESHOLD_MS = 250;

// True iff the interval between two consecutive clicks is short enough
// to count as a double-click. Boundary is inclusive (250 ms = double).
export function isDoubleClick(
  prevClickMs: number | null,
  currentClickMs: number,
  thresholdMs: number = DOUBLE_CLICK_THRESHOLD_MS,
): boolean {
  if (prevClickMs === null) return false;
  return currentClickMs - prevClickMs <= thresholdMs;
}
