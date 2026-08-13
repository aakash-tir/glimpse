# Testing — required automated tests per milestone

Each milestone must ship with the listed automated tests passing before the end-of-milestone checks (see [`milestone-workflow.md`](./milestone-workflow.md)) can complete. **Tests carry forward** — M3's tests must still pass at M5, etc.

## Test stack

- **Unit + component:** **Vitest** + **React Testing Library**.
- **End-to-end:** **Playwright** with `electron-playwright-helpers` (Electron-mode Playwright — drives the actual built app).
- **Mocks:** `vi.fn()` for in-process mocks; **MSW** for HTTP mocks (Open-Meteo, NOAA SWPC, IP geolocation).
- **Coverage:** built-in V8 coverage via Vitest.

## Test layout

```
test/
├── unit/                 Vitest unit tests
├── component/            React Testing Library component tests
├── integration/          Renderer ↔ main-process integration tests
└── e2e/                  Playwright E2E specs
fixtures/
├── open-meteo/           canned API responses
├── noaa-swpc/
└── ip-geolocation/
```

## Commands

| Command | Purpose |
|---|---|
| `npm test` | All tests (unit + component + integration + E2E). Run at end of milestone. |
| `npm run test:unit` | Unit only (fast, for inner-loop dev). |
| `npm run test:component` | Component tests only. |
| `npm run test:e2e` | Playwright E2E only. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:coverage` | Coverage report (V8). |

## What "must exist" means

For each milestone below, every bullet is a test (or small group of related tests) that **must be written and must pass** before the milestone can be marked done. The list is the minimum bar — write more if helpful, but don't ship the milestone without these.

---

## M0 — Project scaffold & toolchain

- **E2E smoke:** `npm run dev` (or built app) launches, shows a window, exits cleanly via API call.
- ESLint / Prettier / `tsc --noEmit` clean. (Lint, not tests, but enforced as a CI gate at end of every milestone.)

## M1 — Icon mode

- **Unit:** `settings.json` read / write — schema defaults applied on absent file; partial files merged with defaults; corrupt JSON falls back to defaults without crashing.
- **Component:** icon renders the right `weather-icons` glyph for each (condition, day/night) input.
- **Component:** hover state scales to 1.15× (verify Framer Motion `animate` prop / data-test attribute).
- **Component:** loading-state animation renders.
- **Component:** error-state renders sad cloud (no tooltip — sad face is the only signal; see [`plan/icon.md` § Error state](../plan/icon.md#error-state-weather-fetch-failed)).
- **Component:** single-click on the icon while in error state is ignored (does not trigger expand IPC).
- **Integration:** icon position persists across simulated app restart (write → relaunch → read).

## M2 — Drag & snap

- **Unit:** click vs double-click disambiguation at the 250 ms threshold (parameterized: 100 ms = double, 300 ms = single).
- **Unit:** snap-to-corner calculation — given a drop point, returns the correct corner / no-snap. All 4 corners, edges and centers ignored, 40 px radius, 16 px padding preserved.
- **Unit:** off-screen detection — saved position vs current display layout returns `should reset` correctly for: monitor disconnected, resolution changed, primary monitor swapped.
- **E2E:** double-click → drag mode active (verify glow class / data attribute); mouse-drag moves the icon; release drops at correct location; click outside exits drag mode.
- **E2E:** single-click in drag mode is ignored (icon does not expand to window).
- **E2E:** single-instance lock — second app spawn does not create a duplicate process (count Electron processes before / after).

## M3 — Window mode

- **Unit:** window-center → icon-center collapse position calculation, including the clamp-to-screen rule for windows whose center is near a screen edge.
- **Unit:** "default position" detection — collapse from default-positioned window snaps icon to default top-right (not window-center).
- **Unit:** square-lock resize — corner drag scales both dimensions equally; min 120 px and max (display-min − margin) enforced.
- **Component:** title bar hidden by default; revealed on top-edge (top ~24 px) hover with correct fade-in / fade-out timing.
- **Component:** title bar layout — left weather icon · centered "Glimpse" wordmark (adaptive color) · right minimize / close. (No standalone relocate button — its behavior was absorbed into minimize.)
- **E2E:** click icon → window expands with scale animation, anchored at icon position.
- **E2E:** title-bar weather icon click collapses to icon **at the window's last position** (in-place collapse).
- **E2E:** minimize-to-icon button collapses **and resets the icon to the default top-right** (the absorbed-relocate behavior).
- **E2E:** × button quits the app (process exits).
- **E2E:** outside-click does NOT close the window (clicking the desktop or another app's window leaves Glimpse open).
- **E2E:** Esc does NOT close the window.
- **E2E:** single-instance lock — collapsed → 2nd launch expands; window open → 2nd launch focuses; in drag mode → 2nd launch exits drag then expands.
- **Integration:** "Track window position" off → window opens at icon location with default size; on → opens at last bounds.
- **Integration:** tracked window bounds off-screen (monitor change) → falls back to default behavior.

## M4 — Slide framework

- **Component:** all 6 placeholder slides render and are uniquely identifiable.
- **Component:** arrow click triggers cube transition (assert Framer Motion `rotateY` variant changes).
- **Component:** dot indicator updates on slide change; active dot is larger.
- **Component:** dot count grows / shrinks when moon-phase or events slides toggle visibility.
- **Component:** dot color adapts (light dots on dark slides, dark dots on light Settings).
- **Unit:** dynamic-count math — when a slide ahead/behind appears or disappears, the *currently-viewed* slide does not shift in the user's view.
- **Unit:** wrap looping logic — right at last → first; left at first → last; same-direction wrap (no reverse-spin).

## M5 — Data layer

- **Unit:** IP geolocation client — mocked HTTP response → returns parsed `{lat, lon}`.
- **Unit:** Open-Meteo client + parser — fixture responses → returns the expected internal forecast shape (hourly array, daily array, current).
- **Unit:** NOAA SWPC client + Kp parser — fixture response → returns the latest Kp value.
- **Unit:** SunCalc moon phase + illumination correctness against a few known dates (full moons, new moons in 2024–2026).
- **Unit:** SunCalc eclipse calculation against known eclipse dates.
- **Unit:** WMO code → `weather-icons` name mapping — every WMO code defined in the spec resolves to a non-empty `weather-icons` name (parameterized over all codes).
- **Unit:** clock-aligned :05 scheduler — given mocked current time, computes the next tick correctly (across :00, :05, :10, :59, midnight).
- **Unit:** sleep / wake handler — missing one or more ticks fires immediate refresh on wake; subsequent ticks resume on schedule.
- **Unit:** backoff sequence — 5 → 10 → 20 → 40 → 60 → 60 (cap), resets to 5 on success.
- **Unit:** aurora visibility filter — every (latitude × Kp) pair from the spec table produces the right visible / hidden result.
- **Integration:** mocked Open-Meteo failure → icon enters error state; recovery on next attempt → returns to normal.
- **Integration:** mocked NOAA failure → special-events slide silently hidden; other data unaffected.

## M6 — Hourly + 7-day slides

- **Component:** hourly slide renders 24 hours from a mocked Open-Meteo response.
- **Component:** 6 hours visible at a time; snap-to-page horizontal scroll advances exactly 6 hours per snap.
- **Component:** edge-fade gradient appears on right when more content; on left when scrolled past start; absent at boundaries.
- **Component:** day vs night icon variant chosen correctly given mocked sunrise / sunset times.
- **Component:** 7-day slide renders today + 6 days, "Today" label on row 1, weekday abbreviations after.
- **Component:** 3 days visible; snap-to-page scroll advances 3 days per snap.
- **Component:** time format respects 12 h / 24 h setting (changing the setting re-renders the times).
- **Component:** loading skeleton with 1.5 s sweep shimmer renders before data arrives.

## M7 — Current + moon + settings

- **Component:** current-conditions tiles — wind arrow rotated by mocked direction degrees; humidity %; sunrise / sunset stacked; feels-like value.
- **Component:** moon-phase slide — large SVG moon graphic reflects mocked phase + illumination %.
- **Component:** moon-phase slide hidden when toggle off; visible when on (and dot count adjusts; current-slide stability rule from M4 holds).
- **Component:** settings slide — every control reads from store + writes back; values persist across simulated restart.
- **Integration:** theme = auto + simulated `nativeTheme` light / dark toggle → 200 ms cross-fade triggers.
- **Component:** tooltip — appears after 200 ms hover delay; correct dark-glass styling (background, border, font).

## M8 — Special events

- **Unit:** event-active detection — given today / tomorrow + event peak dates → returns the correct active set; full moon never appears as special event.
- **Unit:** event ordering — today first then tomorrow; alphabetical by type within each day.
- **Component:** each event slide (aurora, meteor shower, eclipse, blood moon) renders with the right title, content fields, background, and motion present.
- **Component:** "Tomorrow" badge appears on tomorrow events only (plain text, no date).
- **Unit:** aurora visibility text — "Visible from your location" vs "Visible at latitudes ≥ Nº" produced correctly per (lat, Kp) input.
- **Component:** mocked special-events fetch failure → all event slides hidden; dot count drops; current-slide stability rule holds.

## M9 — First-launch onboarding

- **Component:** coachmark overlay renders with correct dim opacity (60 %), spotlight padding (8 px), callout positioning logic.
- **Component:** click-through enabled only on the spotlit element; rest of overlay swallows clicks.
- **Component:** Skip link advances `onboardingCompleted = true` in the store.
- **Component:** Next button advances step.
- **Component:** gesture advancement — simulated arrow-button click on step 2 advances the step.
- **Unit:** skip vs interrupt — skip sets `onboardingCompleted = true`; simulated app-close mid-tutorial does not.
- **Component:** replay tutorial button (Settings) closes window, returns to icon, restarts from step 1.
- **Component:** title bar force-visible during steps 3 and 5.
- **Component:** offline-preview step (step 7) renders a static sample sad-cloud (not the live icon) inside the overlay; two-line copy matches the spec.
- **E2E:** full onboarding flow on a clean profile (no `settings.json`) — completes via Next/Done; advances via gestures on the mock elements; skip exits cleanly and marks completed; interrupted run (close mid-tutorial) resumes from step 1 on next launch.
- _(Design note: the tutorial is a self-contained mock panel, so there is no live app "behind" the overlay — the original "skeletons / sad-cloud behind overlay" E2E tests do not apply. The data fetch still runs in the background during onboarding via the M5 data layer; the post-completion window reflects loading / error state through the existing M5/M6 tests.)_

## M10 — Polish & packaging

- **Build:** `npm run build` produces a valid NSIS installer artifact (`Glimpse Setup.exe`) — smoke check that the file exists and has plausible size.
- **Build:** the multi-resolution `.ico` is generated and embedded in the binary (verify via header inspection).
- **Build:** `app-icon.png` is the 1024 × 1024 export, not the 256 × 256 stopgap.
- All E2E and unit tests from M0 – M9 pass on the production build (run Playwright against the built `.exe`, not just `npm run dev`).
- (Manual: install / uninstall flow on a clean profile, auto-launch verification — covered in `manual-tests.md`, not automated.)

## M11 — Cleanup, blind spots & severe weather

- **Unit:** MSC alert URL construction — bbox is the resolved coordinates ± `ALERT_BBOX_HALF_DEG`, keyless, `f=json`.
- **Unit:** GeoJSON → `WeatherAlert[]` parsing — features missing `alert_name_en` are skipped rather than rendered blank; missing region / risk colour / expiry degrade to sensible defaults; a non-FeatureCollection returns `[]`.
- **Unit:** `status_en: "ended"` features are dropped at parse time (case-insensitively), while `issued` and `continued` are kept and a missing status is not treated as ended. The expiry filter cannot cover this — an ended bulletin can still carry a future `expiration_datetime`.
- **Unit:** the bulletin body never reaches the model — `alert_text_en` is not parsed into `WeatherAlert` at all.
- **Unit:** severity classification — `warning` / `watch` / `advisory` map through, and **any unrecognized `alert_type` degrades to `statement`** (the least prominent), so an unexpected upstream value can never promote itself to the front of the deck.
- **Unit:** alert ordering — most urgent first, then alphabetical by title within a severity, stable across refreshes.
- **Unit:** dedupe — the same bulletin repeated across sub-regions collapses to one slide, keyed on name + severity **only**, carrying the group's latest expiry forward (an open-ended or unparseable expiry counts as the latest). Differing expiries must not defeat the collapse — that is the real-data case the original expiry-keyed version missed.
- **Unit:** dedupe unions the affected regions across the group without repeating one, since the collapsed features are genuinely different areas and keeping only the first would name the wrong place.
- **Unit:** `formatAlertAreas` — one region plain, a few comma-joined, and the tail beyond three collapsed to `+N more` so a province-wide bulletin cannot overrun the slide.
- **Component:** the alert slide shows title, severity, region and expiry **and nothing else** — no bulletin body, at any feed length.
- **Unit:** expiry — alerts past `expiresAtUtc` are dropped; a null or unparseable expiry keeps the alert (better a stale warning than a silently dropped one).
- **Unit:** promotion ordering in `computeVisibleSlides` — a `warning` moves the whole alert group ahead of Today; a watch/advisory/statement group sits with the special events; no alerts leaves the M4 order untouched.
- **Unit:** the M4 current-slide stability rule still holds when the alert group is inserted or removed — `reconcileCurrentSlideIndex` tracks slide *ids*, so re-ordering around the viewer must not move them.
- **Unit:** `resolveDeckIndex` — a promoted warning pulls the deck to index 0 while the user has not navigated; once they have, the reconciled index wins unchanged; no warning, an un-promoted watch, or an empty alert group all leave the deck on Today.
- **Unit:** an empty or absent alert list produces **no** alert slide, and a stale `alertsPromoted: true` with nothing to promote must not shift the deck or leave a gap at the front.
- **Component:** the deck opens on the alert when a warning is already loaded, opens on Today when there is none, **follows a warning that arrives after mount** (the cold-start case), and does **not** move a user who has already navigated. `initialSlideId` (onboarding handoff) outranks a warning.
- **Component:** no alert slide renders at all for an empty list, and the slide disappears when the warning clears.
- **Component:** alert slide renders title, severity label, bulletin text and expiry in the forecast location's timezone; background tint derives from the MSC risk colour; no motion.
- **Integration:** an alerts fetch failure hides the alert slides **and nothing else** — the icon must not enter its error state, and forecast / NOAA data is unaffected.
- **Integration:** no usable location for a tick → alerts cleared rather than left stale.
- **Unit:** `GestureController` — the drag/resize state machine extracted from `main/index.ts`, covering the logic previously reachable only through Playwright.

## Coverage targets

Not a hard gate per milestone, but at the end of M10 aim for:

- **Unit + component:** ≥ 80 % line coverage of `src/`.
- **E2E:** every user-visible flow that has appeared in any milestone's `manual-tests.md` history has at least one E2E covering it (so future regressions catch what we manually verified at the time).

### What the number covers

Until M11 the coverage config excluded `src/main/**`, so the reported figure described the renderer and shared layers only — it read 94.31 % lines while saying "of `src/`". That was wrong in both directions: the four data clients under `src/main/data/` have real unit suites that counted for nothing, and `src/main/index.ts` was credited by nothing because it was measured by nothing.

`src/main/**` is now included and the number is honest. `src/preload/**` stays excluded — it is a `contextBridge` manifest that only executes inside a real Electron preload context, so E2E covers it or nothing does.

**Baseline at end of M11** (`npm run test:coverage`): **82.47 % lines / 80.54 % statements** overall (1,840 of 2,231 executable lines).

| Area | Lines | Note |
|---|---|---|
| `shared/` | 98.42 % | Pure logic, well covered. `icon-position.ts` at 86 % is the weak spot. |
| `main/data/` | 92.51 % | Was invisible before M11. |
| `renderer/src/components/` | 94.31 % | |
| `renderer/src/views/` | 89.51 % | |
| `main/gesture-session.ts` | 100 % | Extracted from `index.ts` in M11 precisely so it could be measured. |
| `main/index.ts` | 0 % | The remaining gap — see below. |
| `main/settings.ts` | 0 % | Thin `app.getPath` wrapper; only meaningful inside Electron. |

`main/index.ts` is 0 % of 273 executable lines and is the single largest drag on the number. It is not untested — the M0/M2/M3/M9 Playwright specs drive it end to end — but Vitest's V8 provider cannot see into the Electron main process, so none of that E2E exercise is credited here. The M11 `GestureController` extraction is the template for closing the gap: move Electron-free decision logic out into a pure module where unit tests can reach it, and leave `index.ts` as the thin Electron-binding shell it should be.

> **Reading the text report.** The `text` reporter omits any file that is at 100 % on all four metrics, so a file vanishing from the table means it is fully covered, not missing. Use `--coverage.reporter=json-summary` for the complete per-file list.
