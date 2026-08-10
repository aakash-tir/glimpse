# Review findings — full application check (2026-06-02)

A whole-app review run after M10 shipped. This file is the durable backlog
for everything that surfaced: what was fixed in the **M10.1-hardening**
follow-up, and what's deliberately deferred. Update the status column as
items are addressed; remove an item only once it's done **and** any plan/
change is folded in.

Severity: **High** = can crash/brick or corrupt data · **Medium** = real
bug, narrow conditions · **Low** = polish / personal-app-acceptable.

## Code findings

| ID | Sev | Area | Finding | Status |
|---|---|---|---|---|
| A | High | `src/main/index.ts` | No `closed` handler / `isDestroyed()` guards — a main-side async callback (data push, theme update, display re-anchor) could `send`/`setBounds` on a destroyed window during quit and throw "Object has been destroyed". | **Fixed (M10.1)** — `liveWindow()` guard + `closed` handler. |
| B | Medium | `src/main/index.ts` | `setLoginItemSettings` could throw inside the un-caught `whenReady().then`, aborting startup (blank window) and never persisting `autoLaunchRegistered` (retries every launch). | **Fixed (M10.1)** — try/catch + `.catch` on the chain. |
| C | Medium | `src/main/data/*` | Bare `fetch` with no timeout — a hung connection stalls the awaited refresh tick indefinitely with no error-state transition. | **Fixed (M10.1)** — `fetchWithTimeout` (10 s) in all 4 clients. |
| D | Medium | `src/main/index.ts` | `location:set-override` wrote the renderer payload without revalidation (merge-time guard only runs on read), so NaN lat/lon could be persisted and drive a forecast fetch. | **Fixed (M10.1)** — `isLocationOverride()` guard in the handler. |
| L1 | Low | `src/main/index.ts` | A second launch during onboarding called `expandToWindow()`, tearing the tutorial panel. | **Fixed (M10.1)** — focus the panel instead when `onboardingActive`. |
| E | Low | `src/main/index.ts` | `DataStore.refresh()` has no in-flight guard; overlapping refreshes (expand + `:05` tick) can both `commit()` and skew the backoff index. | **Fixed (M10.1)** — concurrent callers join the in-flight run and share its result. |
| F | Low | `src/shared/time-format.ts`, `eclipse-slide.tsx` | Eclipse "Peak HH:MM" and the "last updated" subtitle render in the **host** timezone while all other times use the forecast location's zone. Coincides on a single-machine setup. | **Fixed (M10.1)** — `formatLocalClock` takes an IANA zone; callers pass `Forecast.timezone`, falling back to host-local when no forecast has loaded. |
| G | Low | `coachmark.tsx`, `onboarding-controller.tsx` | Onboarding overlay has no focus management (no autofocus to Next on step change, no Escape-to-skip). Only real a11y miss. | **Fixed (M10.1)** — Next takes focus on mount + every step change; Escape skips; `role="dialog"` + `aria-modal`. |

_Reviewed and found correct (no action): the `eslint-disable` at `slide-deck.tsx:233` (keyed on the joined-id string to avoid a reconcile-during-render loop — safe); timezone math in `forecast-window.ts`; aurora / eclipse / moon / special-events logic; all hook cleanup; null/loading/error states._

## Documentation / plan drift

| Finding | Status |
|---|---|
| No plan file stated which timezone clock times render in (surfaced by finding F). | **Fixed (M10.1)** — `plan/slides.md` § Time rendering added; the eclipse bullet corrected from "user's local time". |
| Onboarding keyboard / focus behavior was unspecified (surfaced by finding G). | **Fixed (M10.1)** — `plan/onboarding.md` § Keyboard & focus added. |
| `open-questions.md` step-5 item was actually resolved in M9 (option c). | **Fixed (M10.1)** — entry removed, status set to "no open items". |
| `plan/data-sources.md` § Location said IP-only / "no permission prompt", but the code ships a 3-tier resolver (override → browser geolocation → IP) + a permission prompt. | **Fixed (M10.1)** — Location section rewritten. |
| `plan/tech-stack.md` schema listed 8 of the 14 real settings fields. | **Fixed (M10.1)** — added the 6 missing fields. |
| Cached-location fallback absent from `data-sources.md` failure handling. | **Fixed (M10.1)** — added a "Failure handling (location)" subsection. |
| `tech-stack.md` § Auto-launch didn't mention the register-once `autoLaunchRegistered` nuance. | **Fixed (M10.1)** — noted. |
| `progress.md` M10 provider parenthetical stale (says ipapi.co→ipwho.is; landed on geojs.io). | **Fixed (M10.1)** — corrected. |
| The advanced-location / browser-geolocation subsystem appears in no milestone's scope/DoD. | **Deferred** — decide owning milestone (M5/M7 fit) and record it in `progress.md`. |

## Dependencies

| Finding | Status |
|---|---|
| `npm audit`: 21 vulns (2 critical, 11 high) — **all in the electron-builder dev toolchain** (`node-gyp`, `tmp`, `ws`); none shipped to users. | **Deferred** — `npm audit fix` clears most; low priority. |
| Electron 33 → 41 (8 majors behind; Chromium CVEs). Low real risk (no remote content). Many deps a major behind (React 18→19, Tailwind 3→4, Vitest 2→4). | **Deferred** — schedule an Electron bump; defer framework majors for a personal app. |

## Manual checks still outstanding

Tracked here so they aren't forgotten (automation can't reach these). How-to is in each milestone's `manual-tests.md` history / the M10 list.

- **Auto-start at real login** — Run-key registration verified end-to-end (`electron.app.Glimpse` present + `autoLaunchRegistered: true`); the only untested bit is Windows executing it at next login (OS-guaranteed). Confirm with a sign-out/in, then confirm the Settings → Startup opt-out sticks.
- **Cached-location fallback under a real outage** — block `get.geojs.io` via hosts and relaunch; expect cached location, no error icon.
- **Theme auto-switch** with Windows Light/Dark toggle (≈200 ms cross-fade).
- **Multi-monitor / display change** off-screen icon snap-back.
- **Sleep/wake + long-run** refresh cadence over hours.
- **Animation feel** across slides + onboarding (subjective).
