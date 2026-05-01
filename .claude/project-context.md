# Project Context — Glimpse

## What it is

Glimpse is a small, always-visible desktop weather app for Windows 11. A 64 × 64 icon sits at the top-right of the primary monitor showing the current condition. Clicking the icon expands it into a small square window with horizontally-flipping slides that show the full forecast: hourly, 7-day, current conditions, moon phase, special celestial events, and settings.

## Why it exists

Quick weather glance from anywhere on the desktop, without dedicating taskbar real estate or opening a browser tab. The icon stays out of the way until you want it; the window is small enough to never take over the screen.

## Target user / platform

- **One user** (the developer). Personal use only.
- **Windows 11.** No cross-platform support, no installer signing, no public distribution channel.
- **Online by default.** IP-based geolocation, free public APIs (Open-Meteo, NOAA SWPC). Offline behavior is graceful (sad-cloud + retry) but not the design center.

## Design philosophy

- **Tiny surface area.** No taskbar entry, no system tray icon, no menu bar. The floating icon IS the app.
- **Glanceable first, deep on demand.** Icon shows current condition at a glance; slides give detail when wanted.
- **One gesture, one purpose.** Single click expands; double-click drags; arrow buttons navigate; outside-click does nothing surprising. No keyboard shortcuts.
- **Dark glass with sunset accents.** Default dark glassmorphism, with warm orange / pink / yellow accents (drawn from the app icon) for small interactive surfaces. Special-event slides have themed celestial backgrounds.
- **Subtle motion only.** Framer Motion handles the cube-flip slide transitions and event-background drift. Nothing distracting.

## Hard constraints

- Personal use → no telemetry, no analytics, no auto-update infrastructure, no code signing.
- Single Electron binary, single settings file (`%APPDATA%/Glimpse/settings.json`), no backend, no caching layer.
- Windows 11 only.
- This sub-app's `.claude/` config is intentionally **isolated** from the parent One-Piece project. Future Nova integration is out of scope.

## Glossary

| Term | Meaning |
|---|---|
| **Icon mode** | Collapsed state — the 64 × 64 condition icon visible at top-right (or wherever the user dragged it). |
| **Window mode** | Expanded state — the small square panel showing slides. |
| **Drag mode** | Toggled by double-click on the icon or window body. While active, the element can be repositioned by mousedown-drag-release. Clicking outside exits. |
| **Slide** | One face of the cube-rotating panel: today / 7-day / current / moon / events / settings. |
| **Coachmark** | Spotlight overlay element used during the first-launch onboarding tutorial. |
| **WMO code** | Open-Meteo's weather classification number (e.g. 0 = clear, 61 = light rain). Mapped to `weather-icons` names via a constant table. |
| **Kp** | Geomagnetic activity index from NOAA SWPC (0 – 9). Higher = stronger aurora visibility. |
| **ZHR** | Zenith hourly rate — meteor shower intensity at the radiant's zenith. |

## Project root files

- `app-icon.png` — 256 × 256 RGBA app icon (stopgap; will be replaced with 1024 × 1024 before Phase 2 packaging).
- `plan-review.md`, `plan-review-fix.md` — historical artifacts of the planning rounds. Not load-bearing for implementation; kept for reference.
