// Pure decision logic for the install-time auto-launch registration.
//
// Per plan/tech-stack.md § Auto-launch and plan/packaging.md: the
// installed build registers itself to open at login on its FIRST run
// only. We deliberately do NOT re-register on every launch — once the
// user disables Glimpse via Windows Settings → Apps → Startup, we must
// respect that and never silently flip it back on. A persisted
// `autoLaunchRegistered` flag records that the one-time registration
// already happened.
//
// Guard rails:
//   - Never register in development (`npm run dev`) — only the packaged
//     build should touch the OS login-items list. `isPackaged` is false
//     under electron-vite dev.
//   - Register exactly once: skip if the flag is already set.
//
// Kept pure (no Electron import) so it is unit-testable; index.ts calls
// app.setLoginItemSettings() only when this returns true.

export type AutoLaunchContext = {
  /** app.isPackaged — false under `npm run dev`. */
  isPackaged: boolean;
  /** settings.autoLaunchRegistered — true once we've registered before. */
  alreadyRegistered: boolean;
};

export function shouldRegisterAutoLaunch(ctx: AutoLaunchContext): boolean {
  return ctx.isPackaged && !ctx.alreadyRegistered;
}
