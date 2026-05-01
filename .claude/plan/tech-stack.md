# Tech stack

## Core

- **Runtime:** Electron.
- **Language:** TypeScript + React.
- **Build:** Vite (renderer) + electron-builder (packaging — see [packaging.md](./packaging.md)).

## Dependencies

- **`tailwindcss`** + **`shadcn/ui`** — UI components and design system.
- **`framer-motion`** — cube transitions, scale animations, coachmark spotlights, event-background motion.
- **`react-icons/wi`** — wraps the `weather-icons` font by Erik Flowers — extensive day/night variants and Open-Meteo-friendly mapping.
- **`lucide-react`** — bundled with shadcn/ui; used for the relocate button glyph (`CornerUpRight`) and other UI icons as needed.
- **`suncalc`** — local astronomical calculations: moon phase, illumination, eclipses (no network call).

See [styling.md](./styling.md) for the visual / animation rules and [data-sources.md](./data-sources.md) for the data flow.

## Storage

- **Settings →** `%APPDATA%/Glimpse/settings.json`. Schema:

  | Field | Type | Default | Notes |
  |---|---|---|---|
  | `units` | `'metric' \| 'imperial'` | `metric` | Per the Settings slide. |
  | `timeFormat` | `'12h' \| '24h'` | `24h` | |
  | `iconPosition` | `{ x: number, y: number } \| null` | `null` | `null` = default top-right. |
  | `moonPhaseSlideEnabled` | `boolean` | `false` | Toggles slide 4. |
  | `themeOverride` | `'auto' \| 'light' \| 'dark'` | `auto` | `auto` follows Windows. |
  | `trackWindowPosition` | `boolean` | `false` | When on, persist window bounds. |
  | `windowBounds` | `{ x, y, width, height } \| null` | `null` | Only set when `trackWindowPosition = true`. |
  | `onboardingCompleted` | `boolean` | `false` | See [onboarding.md](./onboarding.md). |

- **Secrets →** `.env` at project root. No keys currently required; placeholder for any future paid source.

## Single-instance lock

`app.requestSingleInstanceLock()`. Behavior on a second launch:

- If the existing instance is in icon mode → **auto-expand to window mode**.
- If already in window mode → **focus the window**.
- If the existing instance is **in drag mode** when a second launch fires → **exit drag mode first, then expand**.

## Auto-launch

`app.setLoginItemSettings({ openAtLogin: true })` registered on installed-build first run.

User can disable via Windows Settings → Apps → Startup like any other app.

## App presence

**No taskbar entry, no system tray icon.** The floating icon is the app's only surface.

## App icon

- **Source asset:** `./app-icon.png` (256 × 256 RGBA PNG at the project root).
- **Build:** electron-builder auto-generates the multi-resolution `.ico` from this asset at packaging time.
- The current asset is a stopgap upscaled from the original 180 px source. User will replace with a 1024 × 1024 export of the same artwork before Phase 2 packaging for crisper Hi-DPI / Start-menu tile rendering. (See [packaging.md](./packaging.md).)
