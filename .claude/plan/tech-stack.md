# Tech stack

## Core

- **Runtime:** Electron.
- **Language:** TypeScript + React.
- **Build:** Vite (renderer) + electron-builder (packaging — see [packaging.md](./packaging.md)).

## Dependencies

- **Styling: inline `style` objects, no CSS framework.** Tailwind and shadcn/ui were scaffolded at M0 and carried unused until M11 — 0 `className` usages against 139 inline `style={{}}` usages, no `components/ui/` directory, and no call sites for `cn()` or `cva()`. Both were removed along with `clsx`, `tailwind-merge`, `class-variance-authority`, `autoprefixer` and `postcss`. `index.css` reproduces the parts of Tailwind's Preflight the inline styles actually depended on (border-box sizing, the root font stack and 1.5 line-height, button/input font inheritance, `svg { display: block }`, margin-less `p`).
- **`framer-motion`** — cube transitions, scale animations, coachmark spotlights, event-background motion.
- **`react-icons/wi`** — wraps the `weather-icons` font by Erik Flowers — extensive day/night variants and Open-Meteo-friendly mapping.
- **`lucide-react`** — used directly for the title-bar close button (`X`) and other UI icons as needed. (Originally arrived as a shadcn/ui dependency; kept on its own merit when shadcn was removed in M11.)
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
  | `advancedLocationEnabled` | `boolean` | `false` | Gates manual location overrides. See [data-sources.md](./data-sources.md) § Location. |
  | `locationOverrides` | `LocationOverride[]` | `[]` | User-entered cities keyed by IP-detected city. Tier 1 of the location chain. |
  | `browserGeolocation` | `{ latitude, longitude, capturedAt } \| null` | `null` | Cached `navigator.geolocation` result. Tier 2. |
  | `locationPermissionAsked` | `boolean` | `false` | True once the one-time location-permission prompt has been shown. |
  | `cachedLocation` | `{ latitude, longitude, city } \| null` | `null` | Last successful IP detection, reused on provider failure (M10). |
  | `autoLaunchRegistered` | `boolean` | `false` | True once open-at-login was registered (M10). Prevents re-registering every launch so a user opt-out sticks. |

- **Secrets →** `.env` at project root. No keys currently required; placeholder for any future paid source.

## Single-instance lock

`app.requestSingleInstanceLock()`. Behavior on a second launch:

- If the existing instance is in icon mode → **auto-expand to window mode**.
- If already in window mode → **focus the window**.
- If the existing instance is **in drag mode** when a second launch fires → **exit drag mode first, then expand**.

## Auto-launch

`app.setLoginItemSettings({ openAtLogin: true })` registered on installed-build first run **only** — a persisted `autoLaunchRegistered` flag prevents re-registering on every launch, so a user who later disables startup keeps it disabled (we never silently re-enable). The OS write is wrapped in try/catch so a failure can't abort startup. See `src/shared/auto-launch.ts`.

User can disable via Windows Settings → Apps → Startup like any other app.

## App presence

**No taskbar entry, no system tray icon.** The floating icon is the app's only surface.

## App icon

- **Source asset:** `./app-icon.png` (1024 × 1024 RGBA PNG at the project root — the canonical artwork export, set at M10).
- **Embedded icon:** `./app-icon.ico`, a committed multi-resolution `.ico` (16 → 256 px) that `build.win.icon` points at. We pre-generate it rather than let electron-builder convert the PNG, because v25 only emits a single 256 px entry from a PNG. (See [packaging.md](./packaging.md) § App icon for the regeneration command.)
