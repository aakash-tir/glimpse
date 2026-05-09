# Progress — Glimpse Milestones

11 milestones (M0 – M10). Each lists scope, the relevant `plan/` files, the test inventory in [`rules/testing.md`](./rules/testing.md), and a Definition of Done. Mark each milestone with a date when its DoD is met.

**Workflow rules:** see [`rules/milestone-workflow.md`](./rules/milestone-workflow.md). Every milestone is built on its own `M<N>-<name>` branch with per-feature commits, runs lint + typecheck + automated tests at the end, generates `manual-tests.md` for user sign-off, then merges to `main` with `--no-ff` and pushes both branches to origin.

**Test inventory per milestone:** [`rules/testing.md`](./rules/testing.md) is the source of truth for which automated tests must exist before a milestone can be marked done.

> **Status:** Planning complete (2026-05-01). No milestones started yet.

---

## M0 — Project scaffold & toolchain

**Status:** Done (2026-05-01)

**Scope.** Bare Vite + React + TypeScript + Electron skeleton with tooling configured. No Glimpse functionality yet.

- Vite + React + TS template in `src/renderer/`.
- Electron main process in `src/main/` with single `BrowserWindow` opening at default size.
- Tailwind CSS configured.
- shadcn/ui initialized.
- Framer Motion, `react-icons/wi`, `lucide-react`, `suncalc` installed.
- electron-builder config in `package.json` (NSIS target, `Glimpse` product name, `app-icon.png` icon source) — config only, no packaging yet.
- TypeScript strict mode + ESLint configured.
- `npm run dev` opens a blank Electron window.

**Refs:** [`plan/tech-stack.md`](./plan/tech-stack.md), [`plan/packaging.md`](./plan/packaging.md). **Tests:** [`rules/testing.md` § M0](./rules/testing.md#m0--project-scaffold--toolchain).

**Definition of done.** `npm run dev` opens a blank Electron window. Lint + typecheck clean. All deps from `tech-stack.md` installed and pinned.

---

## M1 — Icon mode (collapsed state)

**Status:** Done (2026-05-01)

**Scope.** Render and position the icon. Static visual only — no real weather yet (use a placeholder condition).

- 64 × 64 transparent Electron window pinned at top-right with 16 px padding.
- Renders a `react-icons/wi` weather icon (placeholder: sun).
- Hover scale to 1.15× over 150 ms ease-out.
- Loading-state animation: grey cloud with 2 s left-to-right white sweep loop.
- Error-state visual: sad cloud + custom dark-glass tooltip "weather could not be determined" on hover.
- 200 ms cross-fade when the displayed condition changes.
- Position persisted to `%APPDATA%/Glimpse/settings.json` (no real weather data field yet).

**Refs:** [`plan/icon.md`](./plan/icon.md), [`plan/styling.md`](./plan/styling.md), [`plan/tech-stack.md`](./plan/tech-stack.md). **Tests:** [`rules/testing.md` § M1](./rules/testing.md#m1--icon-mode).

**Definition of done.** Icon renders at top-right, hover scales, loading/error states visually correct, position persists across launches.

---

## M2 — Drag & snap behavior

**Status:** Done (2026-05-01)

**Scope.** Make the icon repositionable via the double-click → drag → release flow.

- Single click registers after 250 ms (custom threshold to disambiguate from double-click).
- Double-click (≤ 250 ms) toggles drag mode.
- Drag-mode visual: soft white outer glow, ~12 px blur, 1 Hz pulse.
- Mousedown-drag-release while in drag mode moves the icon.
- Single-click on icon while in drag mode is ignored.
- Click outside the icon exits drag mode.
- Snap to 4 screen corners within 40 px (preserves 16 px padding). Edges/centers do not snap.
- Display-change handler: if saved position is off-screen, reset to default top-right.
- Single-instance lock via `app.requestSingleInstanceLock()` — second launch is a no-op for now (proper window-focus handling comes in M3).

**Refs:** [`plan/icon.md`](./plan/icon.md), [`plan/tech-stack.md`](./plan/tech-stack.md). **Tests:** [`rules/testing.md` § M2](./rules/testing.md#m2--drag--snap).

**Definition of done.** Icon can be dragged via double-click flow, snaps to corners, exits drag mode on outside-click, survives display changes, second launch doesn't spawn a duplicate process.

---

## M3 — Window mode (expanded state)

**Status:** Done (2026-05-04)

**Scope.** Replace the icon with the window on click; drag, resize, collapse.

- Click icon → window scales up from icon position (200 ms ease-out).
- Default window size: 1/6 of primary display's smallest dimension (square).
- Resize via 4 corner handles only; min 120 × 120, max display-margin; width = height enforced.
- Window double-click toggles drag mode (same gesture as icon). Arrow buttons exempt from double-click.
- Window drag bounds: free placement + snap to 4 screen corners (40 px radius).
- Title bar auto-hide: invisible by default; reveals on top-edge (~24 px) hover with 150 ms fade-in / 300 ms fade-out.
- Title bar layout: weather icon · "Glimpse" wordmark (centered, adaptive color) · minimize-to-icon · close.
- Title bar **weather icon** collapses the window to the **window's last position** (window-center → icon-center, clamped to screen). Special case: if window was at default position, icon snaps back to default top-right.
- Title bar **minimize-to-icon button** collapses AND resets the icon position to the default top-right (it absorbed the previously-planned standalone relocate button's behavior; the relocate button itself was removed since the weather-icon already covered the in-place collapse case).
- Close button quits the app entirely.
- Outside-click does NOT close the window. No Esc-to-close.
- "Track window position" setting (default off): when on, persists window size + position.
- Single-instance lock 2nd-launch behavior: if collapsed, auto-expand; if window already open, focus. If first instance is in drag mode when 2nd launch fires, exit drag then expand.

**Refs:** [`plan/window.md`](./plan/window.md), [`plan/icon.md`](./plan/icon.md), [`plan/tech-stack.md`](./plan/tech-stack.md). **Tests:** [`rules/testing.md` § M3](./rules/testing.md#m3--window-mode).

**Definition of done.** Icon expands to window with scale animation, window drags + resizes correctly, title bar auto-hides + reveals, all 3 title-bar buttons work, collapse animates back to icon at the right position. Second launch behaves correctly in all states.

---

## M4 — Slide framework + cube animation + dot indicator

**Status:** Done (2026-05-03)

**Scope.** The 6-slide skeleton with placeholder content. No real data wiring yet.

- 6 placeholder slides: today, 7-day, current, moon, events, settings (each shows just its name in the center for now).
- Cube rotation animation between slides via Framer Motion: 500 ms ease-in-out, rotates in click direction, no reverse-spin on wrap.
- Left + right arrow buttons at panel edges. Only navigation surface (no keyboard, no swipe).
- Slide indicator dots centered along the bottom edge; active dot larger; adaptive color (light on dark, dark on light Settings).
- Dynamic slide count: moon-phase slide and special-events slide can appear/disappear; the currently-viewed slide does not shift when others change.
- Looping wrap (slide 1 ← arrow loops to last; last → arrow loops to slide 1).
- Edge-fade scroll affordance utility (24 px gradient) ready for use on hourly + 7-day slides in M6.

**Refs:** [`plan/slides.md`](./plan/slides.md), [`plan/styling.md`](./plan/styling.md). **Tests:** [`rules/testing.md` § M4](./rules/testing.md#m4--slide-framework).

**Definition of done.** All 6 placeholder slides navigate via cube animation, dots reflect current state, dynamic count works, wrap loops correctly.

---

## M5 — Data layer (location + Open-Meteo + NOAA + SunCalc + meteor JSON)

**Status:** Done (2026-05-07)

**Scope.** All data fetches, refresh scheduling, failure handling. UI still shows placeholders — wired into a single in-memory store accessible from the renderer via IPC.

- IP geolocation on app launch (no API key, no Google service).
- Open-Meteo client: hourly + daily forecast, wind, humidity, feels-like, sunrise / sunset, current weather code.
- NOAA SWPC client: current Kp index for aurora.
- SunCalc integration: moon phase + illumination %, eclipse calculations.
- `src/data/meteor-showers.json` populated with IMO calendar dates (schema: `{name, peakDate, zhr, bestViewingTime, radiantConstellation}`).
- WMO code → `weather-icons` lookup table.
- Refresh scheduler: clock-aligned to :05 of each hour. Fires immediate fetch on window open. Sleep / wake handler triggers immediate refresh on resume if any scheduled tick was missed.
- Failure handling: general weather failure → icon switches to error state, exponential backoff 5 → 10 → 20 → 40 → 60 min capped at 1 h, resets only on success. Special events failure → silently hide the events slide for the session.
- Aurora visibility filter applied per the latitude / Kp table.

**Refs:** [`plan/data-sources.md`](./plan/data-sources.md), [`plan/tech-stack.md`](./plan/tech-stack.md). **Tests:** [`rules/testing.md` § M5](./rules/testing.md#m5--data-layer).

**Definition of done.** All four data sources fetch real data on launch. Refresh schedule fires correctly. Forced offline → icon enters error state and retries on backoff. Sleep / wake test fires immediate refresh.

---

## M6 — Slides: Today (hourly) + Next 7 days

**Status:** Done (2026-05-08)

**Scope.** Wire real Open-Meteo data into slides 1 and 2 with their horizontal-scroll layouts.

- **Hourly slide.** 24 hours rolling, starting at next full hour. Each hour shows: time (12 h / 24 h per setting) · day/night condition icon · temperature · precipitation %. 6 hours visible, snap-to-page horizontal scroll. 24 px edge-fade gradient on right (and on left once scrolled past start).
- **7-day slide.** Today + next 6 days. Each row: day label ("Today" for row 1, then `Mon`, `Tue`, …) · condition icon · high / low · precipitation %. 3 days visible, snap-to-page horizontal scroll. Same edge-fade pattern.
- Day vs night icon variants chosen by comparing each timestep against the user's local sunrise / sunset.
- Loading-state skeleton placeholders (shaped like the real content, 1.5 s horizontal sweep shimmer).
- Time format respects user's 12 h / 24 h setting.

**Refs:** [`plan/slides.md`](./plan/slides.md), [`plan/data-sources.md`](./plan/data-sources.md), [`plan/styling.md`](./plan/styling.md). **Tests:** [`rules/testing.md` § M6](./rules/testing.md#m6--hourly--7-day-slides).

**Definition of done.** Both slides display real weather data with day/night-aware icons, horizontal scroll snap works, edge-fade affordance appears/disappears correctly at boundaries, skeleton loads when data is mid-fetch.

---

## M7 — Slides: Current conditions + Moon phase + Settings

**Status:** Done (2026-05-09)

**Scope.** Build the static-layout slides plus the settings UI and live theme switching.

- **Current conditions slide.** Four metric tiles: Wind (SVG arrow rotated by direction degrees + speed) · Humidity (% with drop icon) · Sunrise/sunset (two times stacked vertically with mini icons) · Feels-like temp.
- **Moon phase slide** (controlled by Settings toggle, default off). Large stylized SVG moon graphic with curved shadow showing current phase. Below: phase name + illumination %. Background `#0a1628` deep navy.
- **Settings slide.** Vertical scroll. In order: Units toggle (metric/imperial) · Time format (12h/24h) · Moon-phase slide toggle · Theme (auto/light/dark) · Track window position toggle · Reset icon position button · Manual refresh button · Replay tutorial button (wired in M9) · About (app name + credits line). Background adapts to resolved theme — `#0f172a` slate in dark mode, `#f8fafc` off-white in light mode.
- Live theme switching via `nativeTheme.on('updated')` with 200 ms cross-fade.
- Custom dark-glass tooltip component used wherever needed.

**Refs:** [`plan/slides.md`](./plan/slides.md), [`plan/data-sources.md`](./plan/data-sources.md), [`plan/styling.md`](./plan/styling.md). **Tests:** [`rules/testing.md` § M7](./rules/testing.md#m7--current--moon--settings).

**Definition of done.** All three slides render real data, settings persist and take effect immediately, theme switches live with cross-fade, tooltips styled consistently.

---

## M8 — Slides: Special events

**Status:** Not started

**Scope.** Conditional special-events slides with per-event backgrounds and subtle motion.

- Conditional rendering: events slide(s) appear only when ≥ 1 event is active today or calendar-tomorrow (system local timezone).
- One slide per active event. Multiple events → multiple slides ordered today-first then alphabetical.
- "Tomorrow" plain-text badge on events whose date is tomorrow.
- **Aurora slide.** Title "Aurora" · Kp value · user-aware visibility text · last-updated time. Background gradient `#0a2e1f` → `#2a0a3e`. Motion: slow shimmer drift, 30 s loop, opacity 0.85 → 1.0.
- **Meteor shower slide.** Title (e.g. "Perseids meteor shower") · peak date · ZHR · best viewing time. Background `#0a0a1f` + 30 – 40 static white star points. Motion: shooting star ~1 every 6 s, 0.6 s trajectory.
- **Eclipse slide.** Title (e.g. "Total lunar eclipse") · type · start/peak/end times · visibility from user's location · magnitude % if available. Background radial `#1a0a0a` → `#2a1010`. Motion: brightness pulse, 4 s period, ±5 %.
- **Blood moon slide.** Title "Blood moon" · peak time · visibility. Background gradient `#2a0a05` → `#5a1a0a`. Motion: pulse with subtle orange shift, 5 s period.
- Backgrounds always celestial-dark regardless of theme setting.
- Failure of special-events fetch → silently hide all event slides for this session (already handled in M5).

**Refs:** [`plan/slides.md`](./plan/slides.md), [`plan/data-sources.md`](./plan/data-sources.md), [`plan/styling.md`](./plan/styling.md). **Tests:** [`rules/testing.md` § M8](./rules/testing.md#m8--special-events).

**Definition of done.** Test fixtures simulate each event type → corresponding slide renders correctly with right background + motion. Multiple-event ordering verified. Tomorrow badge appears at the right boundary.

---

## M9 — First-launch onboarding

**Status:** Not started

**Scope.** Custom 8-step coachmark tutorial that runs on first launch and is replayable from settings.

- `onboardingCompleted` boolean in `settings.json` gates the tutorial.
- Custom coachmark / spotlight overlay component: 60 % black dim, spotlight cuts the active element with 8 px padding + rounded corners, callout bubble auto-positioned, click-through enabled only on the spotlit element.
- 8 steps in order: 1) welcome + click icon to expand, 2) slide navigation arrows, 3) icon ↔ window switching, 4) drag mode (two-line text), 5) relocate button, 6) resize (two-line text), 7) offline state preview (two-line text — heads-up about the sad-cloud + click-disabled state), 8) ends on Settings slide with "You're all set" toast (~3 s).
- Animated cursor performs gestures with click ripples for steps 2, 3, 4, 6.
- Step counter dots along the bottom (matches slide indicator).
- Skip link top-right, ghost styling.
- Hybrid advancement: gesture or "Next" button.
- Title bar force-visible during steps 3 and 5.
- Skip → marks `onboardingCompleted = true`. Closing the app mid-tutorial does NOT mark complete (next launch restarts from step 1). Differentiated deliberately.
- Continues regardless of data state (skeletons + sad cloud appear behind overlay if data not ready).
- Replay button on Settings slide → closes window, returns to icon mode, restarts from step 1.
- Multi-monitor: silent — primary monitor only.

**Refs:** [`plan/onboarding.md`](./plan/onboarding.md), [`plan/styling.md`](./plan/styling.md). **Tests:** [`rules/testing.md` § M9](./rules/testing.md#m9--first-launch-onboarding).

**Definition of done.** First launch (no `settings.json`) triggers the tutorial. All 8 steps work via gesture + via Next button. Skip / interrupt / replay behaviors verified. Toast appears on completion. Tutorial coexists with first-fetch loading + with error state.

---

## M10 — Polish & packaging (Phase 2)

**Status:** Not started

**Scope.** Replace placeholder icon with high-res original, package into a Windows installer, register auto-launch.

- Replace `./app-icon.png` with the user-provided 1024 × 1024 export of the same artwork.
- Verify electron-builder generates the multi-resolution `.ico` correctly.
- Build: NSIS installer producing `Glimpse Setup.exe`. Start-menu entry: "Glimpse". Installed binary: `Glimpse.exe`.
- `app.setLoginItemSettings({ openAtLogin: true })` registered on installed-build first run.
- Manual install / uninstall test on a clean Windows 11 user profile.
- **Cached-location fallback (resilience polish).** Persist the most recent successful `{lat, lon, city}` to `settings.json` and reuse it when the IP-geolocation provider fails (rate limit, transient outage). Primary path is still detect-on-launch per `plan/data-sources.md` — cache is fallback only. Skip on first-ever launch when no cache exists; that case still surfaces as a fetch failure → error state. Deferred from M5 because the in-dev rate-limit was solved by switching providers (ipapi.co → ipwho.is); the cache is for production resilience.
- Final QA pass against the plan: every behavior in `plan/` is reproducible end-to-end.

**Refs:** [`plan/packaging.md`](./plan/packaging.md), [`plan/tech-stack.md`](./plan/tech-stack.md). **Tests:** [`rules/testing.md` § M10](./rules/testing.md#m10--polish--packaging).

**Definition of done.** Installer installs cleanly, app auto-launches at next login, all M1 – M9 behaviors work in the installed build, uninstall is clean.
