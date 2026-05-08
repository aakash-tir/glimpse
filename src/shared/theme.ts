// Resolved theme is the actual light / dark mode the UI renders in.
// It's derived from the user's themeOverride preference plus the host
// OS's current dark-mode flag (only consulted when override = 'auto').
//
// Lives in shared/ so the main process and the renderer agree on the
// resolution rule — main resolves on settings change + nativeTheme
// updates, the renderer doesn't recompute, it just consumes the value.

import type { ThemeOverride } from './settings-store';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Resolve the user's theme preference into the actual mode the UI
 * should render in.
 *
 *   override = 'light' | 'dark' → that override wins outright.
 *   override = 'auto'           → follows the host OS (dark when
 *                                 systemPrefersDark = true).
 */
export function resolveTheme(
  override: ThemeOverride,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (override === 'light') return 'light';
  if (override === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}
