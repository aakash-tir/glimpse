# Issues faced & how they were overcome

A retrospective catalog of every real problem hit while building Glimpse (M0 → M11), reconstructed from the full commit history and [`review-findings.md`](./review-findings.md). Each entry: what went wrong, how it surfaced, and how it was fixed, with the fixing commit(s) for archaeology.

## Recurring themes

Before the chronology, the patterns that repeated across milestones:

1. **Windows DWM/DXGI quirks were the hardest class of bug.** The invisible frame border on frameless transparent windows (`getBounds()` ≠ `setBounds()`), the swap-chain stale-framebuffer race on resize, and OS-level position clamping each cost multiple commits and produced the project's only "probabilistic" fix.
2. **Live data breaks what fixtures bless.** The NOAA parser, the IP-geolocation provider, and four separate aspects of the Environment Canada alert feed all worked perfectly against fixtures and failed against reality. The response became a habit: verify new data paths against the live feed before calling them done.
3. **Wired-but-not-connected gaps.** Twice, a correctly-built layer silently didn't reach the user: the icon was hardcoded to a sun so the error state never showed, and the computed backoff delay was thrown away by the scheduler. The fix each time was an end-to-end-shape integration test that mirrors production wiring exactly.
4. **Honest measurement exposes real gaps.** Coverage excluded `src/main` and read 94% while the most stateful file in the project sat at 0%; there was no CI, so a dependency bump broke the E2E suite between sessions with nobody noticing. Fixing the measurement (include `src/main`, add CI) immediately surfaced real bugs.
5. **The plan drifts from the code unless actively reconciled.** Whole subsystems (advanced location) shipped without appearing in any milestone scope; behaviors (render timezone, onboarding keyboard) existed unspecified. Post-M10 review added the discipline of reconciling `plan/` after every surprise.

---

## M0 — Scaffold

### Prettier vs Windows line endings

- **Problem:** `prettier --check` failed on a fresh Windows checkout — files stored as LF in the index checked out as CRLF under git's default `core.autocrlf=true`, and the strict `endOfLine: "lf"` rule rejected them.
- **Fix:** relaxed to `endOfLine: "auto"` — acceptable for a single-machine project. (`60b3bdf`)

## M1 — Icon mode

### The error-tooltip saga (part 1 of 2)

- **Problem:** the error tooltip ("weather could not be determined") rendered 8 px below the icon — outside the 64 × 64 BrowserWindow. Windows only paints inside a window's bounds, so the tooltip was invisible, then clipped, through several window-height adjustments (64 → 260×100 → 130 → 116 → 112). Each fix bought room but bloated the transparent window.
- **How it surfaced:** manual testing — the tooltip simply never appeared.
- **Fix (interim):** enlarged the window and anchored the tooltip inside it (`bccbd27`, `490dc6d`, `847821b`, `8b6ce93`). The oversized window later caused its own bug (see M3 B3b), and the tooltip was ultimately **removed entirely** in M6 — see part 2.

### Icon window grew scrollbars

- **Problem:** the 1.15× hover scale (64 → ~74 px) and some `weather-icons` SVGs painting beyond their viewBox triggered browser scrollbars inside the transparent window.
- **Fix:** `overflow: hidden` on `html`/`body`/`#root`. (`394fc43`)

### Hover scale stuck at 1.15×

- **Problem:** entering drag mode mid-hover swapped Framer Motion's `whileHover` to `undefined`, leaving the scale frozen at 1.15 with no path back. The drag glow also had a hard inner edge (box-shadow follows the bounding box, not the icon's silhouette).
- **Fix:** explicit state + `animate` instead of `whileHover`; `drop-shadow` filter (alpha-silhouette-aware) instead of box-shadow. (`c167fd7`)

### Accidentally committed test state

- **Problem:** the manual-test "error" state was committed as the app's default, so `git checkout --` restored a sad cloud instead of the sun.
- **Fix:** reverted; a reminder of why `manual-tests.md` toggles use `sed` against a known baseline. (`75d95c2`)

## M2 / M3 — Drag, snap, window mode

### Windows DWM frame drift (the gift that kept giving)

- **Problem:** frameless transparent windows carry an invisible OS resize border, so `getBounds()` reports a few pixels more than what `setBounds()` set. Three separate bugs traced to this one quirk:
  - E2E bounds assertions failed by a few pixels (`737f299` — switched to `getContentBounds()` + ±2 px tolerance).
  - **The window visibly grew during drags** — each mousemove's read-modify-write accumulated the rounding error (`5534ec7` — snapshot the size once at `drag:start`, never call `getBounds()` in the per-tick path).
  - Collapse landed the icon ~7 px off (`18516fd` — track `lastWindowBounds` as *the values we set*, never the OS read-back).
- **Lesson:** on Windows, treat window geometry as write-only; keep your own source of truth.

### Drag-mode glow invisible on the window

- **Problem:** the window panel fills its whole BrowserWindow, so a `drop-shadow` (which extends *outside* the element) was clipped at the window boundary — the "glow" read as a color shift. Separately, the conditional glow-wrapper re-parented the panel, remounting it and replaying the entry scale animation on every drag-mode toggle.
- **Fix:** inset `box-shadow` ring painted *inside* the panel edge; glow moved to an overlay sibling so the panel never remounts. (`6283066`)

### Multi-monitor was a second-class citizen

- **Problem:** snap-to-corner only knew the primary display; collapsing a secondary-monitor window yanked the icon back to the primary; expand would then yank it back again — a bounce.
- **Fix:** snap, expand, and collapse all became display-aware in one coherent change (`b8aa8e1`), plus display-edge clamping for window drags mirroring the icon's algorithm (`9d73d4e`).

### The B3b clamp mystery → icon window shrunk to 96 × 96

- **Problem:** placing the icon at a screen-edge midpoint required the (still tooltip-sized, 260 × 112) icon window to sit at screen `x = -164`. Windows allows negative positions at corners but **clamps them at edge midpoints**, shifting the icon ~54 px off spec. The root cause was the M1 tooltip's oversized window.
- **Fix:** icon window reduced to 96 × 96 with the glyph centered — every position became reachable, and the E2E that had to be skipped (`B3b`) was un-skipped. (`9303be2`, spec rewrite in `18516fd`)

### Stale click timer expanded the window from drag mode

- **Problem:** a click on the icon in drag mode queued the 250 ms single-click timer; clicking outside within that window exited drag mode *first*, so when the timer fired, the "ignore clicks in drag mode" guard no longer applied — and the window expanded.
- **Fix:** `cancelPending()` on every drag-mode exit; pending clicks die with the mode. (`752a23f`)

### E2E flake: double-click racing React

- **Problem:** the `doubleClickIcon` E2E helper could `mousedown` before React committed the drag-mode state, failing intermittently.
- **Fix:** the helper now awaits `data-drag-mode="on"` before proceeding — verified deterministic across repeated runs. (`b8aa8e1`)

## M4 — Slide framework

### The glyph-flash race (four attempts, one honest workaround)

- **Problem:** clicking the icon flashed the weather glyph for one frame at the *top-left of the resized window*. Root cause: `setBounds()` resizes the window before the renderer paints, so DWM stretches the stale 96 × 96 framebuffer — glyph included — into the new bounds.
- **The journey:** hide on `resize` event (`4de0461` — still racy), hide via synchronous state flag (`752a23f` — narrowed it), opacity fade-out (`3f9d2a8` — masked it), center-anchor the glyph so the stale frame at least aligns (`5d35fce` — right idea, incomplete), and finally: `visibility: hidden` + `flushSync` + **three** nested `requestAnimationFrame`s before firing the expand IPC, giving the GPU composite and DXGI swap-chain present time to publish the glyph-hidden frame (`751202c`).
- **Honesty:** two rAFs still flashed under GPU load; three makes it "effectively unobservable". The fix is explicitly documented as probabilistic, with the deterministic alternative (never resize the window) noted as a larger refactor not justified for a now-rare flash (`249e31e`).

### Cube transition looked like a card flip

- **Problem:** slides faded while rotating, backfaces mirrored through, and the desktop wallpaper bled through the transparent window at the 90° edge-on point.
- **Fix:** dropped the opacity fade (cubes turn, they don't dissolve), added `backface-visibility: hidden`, restored a solid backdrop (`92ebd5f`) — then redesigned to a PowerPoint-style shared-hinge cube where both faces live on one rotating wrapper, which allowed the backdrop to go transparent *deliberately* so the wallpaper shows through the gap (`0549f70`).

## M5 — Data layer

### NOAA parser built against the wrong shape

- **Problem:** the parser expected the documented 2D-array-with-header format; the live `noaa-planetary-k-index.json` returns an array of objects. First live fetch: "header row missing".
- **Fix:** parser rewritten against the real shape; fixture replaced with a real captured response. (`d6feca9`) First instance of the *live data vs fixtures* theme.

### IP-geolocation provider roulette

- **Problem:** ipapi.co rate-limited dev relaunches (HTTP 429). The replacement, ipwho.is, sat behind Cloudflare bot-fight which rejected Node fetch's TLS fingerprint with 403 — even with a User-Agent header.
- **Fix:** settled on geojs.io (different Cloudflare zone config, keyless access works); parser coerces its string lat/lon. A cached-location fallback was queued for M10 so a future provider outage degrades gracefully instead of breaking launch. (`3998c86`, cache landed in `9c8ad87`)

### Backoff computed, then thrown away

- **Problem:** the store correctly computed the 5→10→20→40→60-min retry delay on failure — and `main/index.ts` discarded it, so failures waited up to a full hour for the next :05 tick.
- **Fix:** the scheduler's callback can now return `{ nextDelayMs }` to override the next tick; success drops the override. (`d6b61dc`)

### The icon was hardcoded to a sun

- **Problem:** the entire data layer worked, and none of it reached the user — `IconView` rendered a hardcoded clear-day sun, so the error state was invisible.
- **How it surfaced:** M5 manual testing.
- **Fix:** `useDataSnapshot` hook wired end-to-end (`78a1406`), then a dedicated integration test that assembles *real* DataStore → real subscribe → bridge → real IconView, so any future wiring break fails in CI rather than at runtime (`6ccc909`).

### "Window open" meant the panel, not the app

- **Problem:** the spec's "fetch immediately on window open" was implemented as app-launch only, so a panel opened hours into a session showed up-to-60-minutes-stale data.
- **Fix:** one `dataStore.refresh()` kick inside `expandToWindow`. (`365e345`)

### SunCalc has no eclipse function

- **Problem:** the plan assumed SunCalc computed eclipses. It doesn't.
- **Fix:** bundled a static NASA-catalog JSON (`src/data/eclipses.json`) with the same yearly-refresh tradeoff as the meteor calendar, and updated the plan to match reality. (`e72ebe9`, `04a6b12`)

## M6 — Hourly + 7-day slides

### The horizontal scroller nobody could scroll

- **Problem (three rounds):** `overflow-x` with a hidden scrollbar made the slider invisible to mouse users — a wheel scroll did nothing (`909f910`: redirect vertical wheel to horizontal, `passive: false` because React's synthetic `onWheel` can't `preventDefault`). Then page-snapping felt like teleporting (`b0e86b5`: snap per cell, not per page). Then one wheel notch advanced 2–3 hourly cells because ~40 px cells absorb a ~100 px wheel notch differently than the 7-day slide's ~80 px cells (`d40f9b1`: ignore delta magnitude, `Math.sign(deltaY) × cellWidth` — exactly one cell per notch).
- **Lesson:** scroll feel is per-surface; what feels right at one cell width is broken at another.

### The error-tooltip saga (part 2: removal)

- **Problem:** M6 sign-off review found (a) the tooltip text clipped again — the now-96 × 96 window physically cannot contain ~200 px of text, and (b) clicking the sad cloud expanded into a window of skeletons — confusing and useless offline.
- **Fix:** both resolved by one UX principle: *the sad cloud is the sole offline signal.* Tooltip deleted, click-to-expand suppressed in error state, and a new onboarding step (step 7 of 8) forewarns the user about the offline state so the unresponsive sad cloud isn't a surprise. Plans updated first, per project rules. (`e993467`)

## M7 — Current + moon + settings

### The renderer build broke silently — and `tsc` didn't notice

- **Problem:** importing a helper from `shared/settings-store.ts` into a renderer component dragged `node:fs` into the renderer bundle. `tsc --noEmit` passed; only `npm run build` surfaced `"readFileSync" is not exported by "__vite-browser-external"`. Meanwhile the dev app launched with **no icon at all** — the preload script had failed to load.
- **Fix:** split the module — pure types/helpers stay in `shared/`, file I/O moved to a main-only `settings-fs.ts`. (`98ea8a3`) The gate lesson: typecheck alone doesn't prove the bundle builds.

### The wrong feels-like that spawned a subsystem

- **Problem:** user report — feels-like showed 8 °C when ~17 °C was expected. Root cause candidates: stale snapshot, or IP geolocation placing Open-Meteo on a different grid cell (different elevation → different model output).
- **Fix, escalating:** first a diagnostic city · last-updated subtitle on the Current slide (`5b600fd`), then the full **advanced-location subsystem** — 3-tier resolver (manual override → browser geolocation → IP), geocoding city search, per-city override list that goes dormant when traveling (`241ce8c`, `869e37a`). One wrong number turned into the app's location-accuracy story.

### Location prompt broke every downstream E2E

- **Problem:** the new first-launch prompt (z-index 50, `inset: 0`) covered the resize handles (z 20) and title bar (z 10). Fresh-profile E2E launches showed the prompt by default, blocking every panel interaction after it.
- **Fix:** prompt lowered to z-index 8 (dim still reads as modal), and M3's E2E `resetSettings()` seeds `locationPermissionAsked: true` — those tests aren't about the prompt. (`fa9191c`) Also: prompt made scroll-on-overflow after it clipped its own buttons at default window sizes (`c3f6550`).

### Settings didn't fit small windows

- **Problem:** labeled "On / Off" segmented controls crowded row labels at narrow widths (labels wrapped, "Units" clipped); the Advanced-location form simply didn't fit.
- **Fix:** iOS-style switches for binary rows (`55a5da6`), all segmented controls collapse to switches below a 280 px threshold with explicit off-position semantics (`f8e6992`), bracketed default-value hints so the switch positions stay interpretable (`3d07ff3`), and the advanced form hidden in compact mode.

### Unobservable refresh button

- **Problem:** the user couldn't tell whether Settings → Refresh did anything — the data layer is silent by design.
- **Fix:** temporary `[refresh] started/finished` logs for the manual test, removed at milestone wrap-up once the wiring was confirmed via the last-updated subtitle. (`3e200aa`, removed in `fa9191c`)

## M8 — Special events

- **Tomorrow badge overlapped long titles** (e.g. meteor-shower names) on narrow windows → `EventSlideShell` measures the collision via ResizeObserver and relocates the badge below the dots. (`077afb5`)
- **Aurora shimmer read as static** — an opacity pulse on a faint overlay → replaced with two wandering radial ribbons inset −70% so the falloff lands outside the pane (no hard clip-lines). (`4d3e8a7`)
- **Redundant slides:** a total lunar eclipse *is* a blood moon; showing both slides was noise → consolidated, with eclipse timing folded into the blood-moon slide. (`9757507`)

## M9 — Onboarding

### Step 5 taught a button that no longer existed

- **Problem:** the onboarding plan's step 5 demonstrated the "relocate button" — removed back in M3 when its behavior was folded into minimize-to-icon. Caught when M3 shipped and parked in `open-questions.md` rather than as a TODO in the plan.
- **Fix:** step re-targeted at the minimize button; the open question was closed and the answer folded into `plan/onboarding.md`. (`2df5ddc`) The one full lifecycle of the project's open-questions process.

### Design pivot: self-contained mock panel

- **Problem:** the original design — a desktop-wide dim spotlighting the *live* app — required a second window and click-through forwarding, heavy machinery for a tutorial.
- **Fix:** the tutorial became a self-contained panel with mock UI elements and an animated gesture cursor; the plan's "skeletons behind the overlay" E2E cases were retired as no-longer-applicable, documented in `rules/testing.md`. (`2df5ddc`, `7cd47bb`) Existing M2/M3 E2E had to seed `onboardingCompleted: true` so the tutorial wouldn't own their windows.

## M10 — Polish & packaging

- **electron-builder emitted a single 256 px icon** from the PNG source, making the taskbar/Alt-Tab icon blurry → pre-generated a multi-resolution `.ico` (16–256 px) and pointed the build at it; a build test asserts the multi-res structure. (`d308f21`)
- **Packaged build was never E2E-tested** → E2E launch centralized into a helper that drives either the dev output or the real `Glimpse.exe` (`GLIMPSE_E2E_PACKAGED=1`); all 29 specs pass against the production binary. (`771206a`)

## Post-M10 whole-app review (M10.1) — the findings that were already there

A deliberate full review after "done" found 8 code findings, all fixed in `M10.1-hardening` (full table in [`review-findings.md`](./review-findings.md)):

- **Use-after-destroy on quit** — async callbacks could `send`/`setBounds` on a destroyed window → `liveWindow()` guard + `closed` handler. (`29c84b8`)
- **Auto-launch registration could abort startup** — an uncaught throw in `whenReady().then` meant a blank window *and* a retry every launch → try/catch + `.catch` on the chain. (`87f4f6b`)
- **No fetch timeouts** — a hung connection stalled the awaited refresh tick forever with no error state → shared `fetchWithTimeout` (10 s) in all four clients. (`bd21a63`)
- **NaN coordinates persisted via IPC** — the validation guard ran on read, not write → validate in the handler. (`8502cc9`)
- **Concurrent refreshes double-fetched and skipped backoff rungs** (5 → 20) → concurrent callers join the in-flight run. (`3853dd1`)
- **Eclipse times rendered in the host timezone** while everything else used the forecast location's zone — invisible on a single-machine setup with no override, which is exactly why it survived → `formatLocalClock` takes an IANA zone. (`d065bfb`)
- **Keyboard users got stranded in onboarding** — no focus management, no Escape → Next takes focus every step, Escape skips, `role="dialog"`. (`faec720`)
- **Doc drift**: the advanced-location subsystem appeared in *no* milestone's scope; timezone and keyboard behavior were unspecified; the settings schema listed 8 of 14 fields → all reconciled, with the subsystem recorded retroactively in M7 where git history shows it shipped. (`02f347f`, `cce0200`)

### The dependency catch-up, and what the Electron bump exposed

- **Problem:** `npm audit` had drifted to 30 advisories; Electron was 8 majors behind.
- **Fix:** staged — lock-only `npm audit fix` (30 → 20), Electron 33 → **43** (chose latest over the named 41 since Electron supports only three majors), then vite 5 → 7 / vitest 2 → 4 to clear the rest: **0 vulnerabilities**. (`be64eb2`, `0bb1743`, `daff125`)
- **The latent bug it exposed:** a window edge-snap wrote the *carried* axis through unclamped. Electron ≤ 40 silently clamped off-screen values inside `setBounds`, masking it since M3; Electron 41+ honors the value, and E2E promptly parked a window at `x = −228`. Fixed with a display-aware clamp + 6 regression tests. (`8ced2a9`) A dependency upgrade acting as a bug-finder.
- **Also surfaced:** Vitest 4's stricter `vi.fn()` typing required naming mock contracts; Electron 43's toolchain wants Node ≥ 22.12 while the dev machine runs 20 (works, warns — CI pins Node 22).

## M11 — Cleanup, blind spots & severe weather

### Tailwind was installed for 11 milestones and never used

- **Problem:** 0 `className` usages against 139 inline `style={{}}` objects; the whole utility-CSS layer was inert weight. But removal wasn't free: Preflight's resets were silently load-bearing — the root font stack (every surface but one inherited Preflight's sans over Chromium's serif default) and `line-height: 1.5` (settings rows sized against it).
- **How verified:** no automated test asserts any visual property, so: screenshot every slide before and after, compare — pixel-identical apart from the live clock. (`adbdb5a`)

### The coverage number was lying

- **Problem:** the config excluded `src/main/**`, so the headline "94.31% of `src/`" described only the renderer — the data clients' real test suites counted for nothing, and the 1,013-line `main/index.ts` was credited by nothing because nothing measured it.
- **Fix:** include `src/main`; accept the honest 80.56% baseline; then close the gap structurally — `GestureController` extracted from `index.ts` (1,013 → 848 lines), Electron-free by construction (callers pass display state in, get an intent back), 100% covered by 23 unit tests. The extraction is the documented template for shrinking the remaining `index.ts` gap. (`d384239`, `1e20d58`) That asymmetry — the most stateful code reachable only through Playwright — is *why* the M3 edge-snap bug survived until an Electron upgrade found it.

### No CI, and the week it cost

- **Problem:** every gate ran only by hand on one machine; a dependency bump broke the E2E suite between sessions with no signal.
- **Fix:** GitHub Actions on `windows-latest` (Windows-only app; a Linux-xvfb shortcut would test a platform the app doesn't target), Node pinned to 22, `if: !cancelled()` so one push reports all failures at once. (`69654fc`)
- **Immediate payoff:** first post-merge CI run went red on two M3 E2E tests that pass locally every time — the `dragWindowToMiddle` helper hard-coded a −1100 px drag calibrated to the dev machine's wide monitor; on CI's narrower display the window hit the left edge and clamped to `x = 0`. Display-dependent since M3, surfaced the first time the specs ran anywhere else. Fixed by deriving the drag delta from the actual work area. (`1b7ca0c`)

### Everything the live alert feed taught (fixtures would have caught none of it)

The Environment Canada client worked against fixtures on day one. The live feed then disproved four assumptions in a row:

1. **Sub-region duplicates don't share an expiry.** Dedupe was keyed on name + severity + expiry, assuming copies of one bulletin match; the live Kelowna warning arrived as two features expiring 71 minutes apart — the key let the duplicates straight through. Re-keyed on name + severity only, carrying the group's *latest* expiry forward (null/unparseable counts as open-ended). (`be59f0e`)
2. **"Ended" bulletins carry future expiries.** ~1 in 6 live features nationwide is `status_en: "ended"` with an `expiration_datetime` still hours out, so the expiry filter can't catch them — the deck was showing a warning that had already finished. Dropped at parse time, case-insensitively; missing status is *not* treated as ended. (`350d9da`)
3. **Deduped features are different places, not copies.** Keeping the first feature's region would have printed "North Okanagan" for a user in Central Okanagan. Regions are unioned across the group, capped at three with `+N more`. (`350d9da`)
4. **The bulletin body is a document, not a summary.** `alert_text_en` runs past 2,000 characters of health advice and phone numbers; rendered on a 300 px glance slide it buried everything. Dropped at the parser — it never enters the model. The slide states *what · where · until when*. (`350d9da`)

Plus one defensive rule from the same work: an **unknown `alert_type` degrades to the least prominent severity**, never the most — an unexpected upstream value must not promote itself to the front of the deck. (`b6d0822`)

### Cold start defeated the promotion rule

- **Problem:** "the deck opens on a warning" worked only when alert data was already in the store. On a cold start the window opens before the first fetch returns, the deck lands on Today, and when the warning arrives, the M4 stability rule does its job *too well* — it keeps the user on Today, with the warning inserted one slide behind where they're looking. The more urgent the situation, the more likely the app wasn't already open: the failing case was the case that mattered.
- **Fix:** `resolveDeckIndex` lets a promoted group pull the deck forward *until the user first navigates*; the instant they touch an arrow, the never-move-the-viewer rule takes over unconditionally. The onboarding handoff counts as navigation. Verified in the same pass: an empty alert list produces no slide, and a stale `alertsPromoted` flag can't shift the deck. (`2d7e3d3`)

---

## What the history says about process

- **Manual-test sign-off caught what automation couldn't** — the M3 collapse-drift spec rewrite, the M6 offline-UX rethink, the M7 feels-like report, and the M11 visual sweep all came from a human looking at the running app.
- **The improvement review after "done" was worth it** — eight real bugs (one High) existed in a fully-tested, shipped app, none reachable by the existing suites.
- **Measurement gaps hide bug classes.** Every honesty fix (include `src/main` in coverage, add CI, run E2E against the packaged exe, verify against live feeds) surfaced at least one real defect within days.
