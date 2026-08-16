# Glimpse

A tiny, always-visible desktop weather app for Windows 11. A 64 × 64 floating icon sits at the corner of your screen showing the current condition; click it and it expands into a small square window with cube-flipping slides — hourly forecast, 7-day, current conditions, moon phase, celestial events, severe weather alerts, and settings.

No taskbar entry, no system tray, no browser tab. The icon **is** the app.

## Features

- **Icon mode** — a frameless 64 × 64 condition icon, draggable (double-click to enter drag mode) with corner snapping.
- **Window mode** — a small square panel with slide navigation, auto-hiding title bar, square-locked corner resize.
- **Slides** — 24-hour forecast, 7-day forecast, current conditions (wind / humidity / sunrise-sunset / feels-like), moon phase, and settings.
- **Celestial events** — aurora (NOAA Kp index with latitude-aware visibility), meteor showers (IMO calendar), eclipses and blood moons (SunCalc), each with its own themed slide.
- **Severe weather alerts** — Environment Canada warnings/watches/advisories as dedicated slides; an active warning is promoted to the front of the deck. **Canada only.**
- **First-launch onboarding** — an 8-step coachmark tutorial with animated gesture demos, replayable from settings.
- Light/dark/auto theme, metric/imperial units, 12 h/24 h time, hourly refresh aligned to :05 with exponential backoff on failure, sleep/wake recovery, and a cached-location fallback.

## Requirements

- **Windows 11** — this is Windows-only by design; there is no macOS/Linux support and none planned.
- **Node.js 22.12+** (the Electron 43 toolchain declares `node >= 22.12`; Node 20 works today but warns).
- npm.

## Quick start

```bash
git clone https://github.com/aakash-tir/glimpse.git
cd glimpse
npm install
npm run dev
```

The icon appears at the top-right of your primary display. Single-click expands it; double-click toggles drag mode.

## Building an installer

```bash
npm run build:win
```

Produces `release/Glimpse Setup.exe` (NSIS). The build is **unsigned** — Windows SmartScreen will warn on first run; that's expected for a personal project with no code-signing certificate.

## Tests

```bash
npm test               # everything: unit + component + integration + build + E2E
npm run test:unit      # fast inner loop
npm run test:e2e       # Playwright driving the real Electron app
npm run test:coverage  # V8 coverage report
npm run lint && npm run format:check && npm run typecheck
```

~1,000 Vitest tests plus Playwright E2E specs; CI (`.github/workflows/ci.yml`) runs all gates on `windows-latest` on every push.

## Data sources

All free, keyless public APIs — there is nothing to configure:

| Source | Used for |
|---|---|
| [Open-Meteo](https://open-meteo.com/) | Hourly/daily forecast, current conditions, geocoding for city search |
| [NOAA SWPC](https://www.swpc.noaa.gov/) | Planetary Kp index (aurora) |
| [Environment Canada MSC GeoMet](https://api.weather.gc.ca/) | Severe weather alerts (Canada only) |
| [geojs.io](https://www.geojs.io/) | IP geolocation (fallback tier; manual override and browser geolocation come first) |
| [SunCalc](https://github.com/mourner/suncalc) | Moon phase, illumination, eclipse math (offline) |
| Bundled IMO calendar JSON | Meteor shower dates (offline) |

Location resolution sends one request to an IP-geolocation service unless you set a manual location in Settings. There is no telemetry, no analytics, and no backend — the app talks only to the weather APIs above and stores a single `settings.json` under `%APPDATA%/Glimpse/`.

## Known limitations

- Severe weather alerts cover **Canada only** (Environment Canada feed) — a deliberate scope choice.
- Windows 11 only; primary monitor only for onboarding.
- Unsigned builds (see above). No auto-update — pull and rebuild.

## Project docs

The full design history lives in [`.claude/`](./.claude/): [`project-context.md`](./.claude/project-context.md) (what and why), [`progress.md`](./.claude/progress.md) (milestones M0–M11), [`plan/`](./.claude/plan/) (per-topic specs), and [`rules/`](./.claude/rules/) (workflow + per-milestone test inventory). The plan files are the source of truth for behavior.

For the war stories, see [`issues-history.md`](./.claude/issues-history.md) — a retrospective of every real problem hit while building this (Windows DWM quirks, live APIs disproving fixtures, a probabilistic three-`requestAnimationFrame` fix) and how each was overcome.

## Status & support

This is a personal project built for one desk. The source is public so you can use it, learn from it, or try to break it — issues and PRs are welcome but responses are best-effort with no guarantees.

## License

[MIT](./LICENSE)
