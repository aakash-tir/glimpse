# Styling

Tailwind + shadcn/ui base. Dark default with subtle glassmorphism. The visual system is intentionally restrained — celebratory motion happens only on the special-event slides.

## Color palette

### Sunset accents

Drawn from the app icon (`./app-icon.png`):

| Role | Hex |
|---|---|
| Warm orange (primary accent) | `#ff8c42` |
| Pink (secondary accent) | `#ff6f91` |
| Golden yellow (highlight) | `#ffd166` |

**Used for:** slide-indicator dots, button hover states, active toggle fills, other small accent surfaces.

**Never used for:** tile backgrounds (so weather data stays legible against neutral surfaces).

### Slide backgrounds

| Slide | Background |
|---|---|
| Today (hourly) | Default dark glass |
| 7-day | Default dark glass |
| Current conditions | Default dark glass |
| Moon phase | Deep navy `#0a1628` |
| Special events — aurora | Linear gradient `#0a2e1f` → `#2a0a3e` |
| Special events — meteor shower | Solid `#0a0a1f` + scattered static white star points |
| Special events — eclipse | Radial gradient `#1a0a0a` (center) → `#2a1010` (edges) |
| Special events — blood moon | Linear gradient `#2a0a05` → `#5a1a0a` |
| Settings (dark mode) | `#0f172a` |
| Settings (light mode) | `#f8fafc` |

**Event backgrounds always stay celestial-dark**, regardless of the user's theme setting.

Settings is the **only theme-adaptive slide background**.

## Theme

- **Setting:** auto / light / dark (default `auto`).
- **Auto** follows Windows live via Electron's `nativeTheme.on('updated')`.
- **Theme switches use a 200 ms cross-fade** between palettes.

## Animations

- **Library:** **Framer Motion** for cube transitions, scale animations, coachmark spotlights, and event-background motion.
- **Window open / close:** scale animation, **200 ms ease-out**, anchored at the icon's position.
- **Cube slide transition:** **500 ms ease-in-out**, rotates in the direction of the arrow click. No reverse-spin on wrap (loops continue in click direction).
- **Icon hover:** scale 1.15× over **150 ms ease-out**.
- **Icon condition cross-fade:** **200 ms** when the displayed condition changes.
- **Drag-mode glow:** soft white glow with a gentle **1 Hz** pulse. Two visual variants for the same intent:
  - **Icon mode:** outer halo around the glyph (~12 px blur). Implemented as a `drop-shadow` filter on the glyph wrapper, so the halo follows the glyph's alpha silhouette and bleeds into the surrounding transparent window.
  - **Window mode:** **inset** glow ring along the panel's inner edge (~12 – 16 px blur). The window panel fills the entire `BrowserWindow`, so a `drop-shadow` would be clipped at the window boundary; an `inset box-shadow` paints inside the panel and reads as a luminous border. Implemented as an absolutely-positioned overlay sibling so toggling drag mode does not remount the panel and replay its entry animation.
- **Title bar reveal:** **150 ms fade-in**, **300 ms fade-out** when hovering the top edge.
- **Loading skeleton shimmer:** subtle horizontal sweep, repeating every **~1.5 s**.

### Per-slide background motion

| Slide | Motion |
|---|---|
| Today, 7-day, current, moon, settings | None (static). |
| Aurora | Slow shimmer drift, ~30 s loop, opacity oscillates 0.85 → 1.0. |
| Meteor shower | Occasional shooting star, roughly 1 every 6 s, ~0.6 s trajectory, fades at end. |
| Eclipse | Slow brightness pulse, 4 s period, ±5 % amplitude. |
| Blood moon | Slow pulse with subtle color shift toward orange, 5 s period. |

## Tooltip (custom dark-glass)

| Property | Value |
|---|---|
| Background | `rgba(20, 20, 30, 0.85)` |
| Backdrop blur | 8 px |
| Border radius | 8 px |
| Border | 1 px white-10 % |
| Text | white, ~12 px |
| Hover delay | 200 ms before show |

## Adaptive text colors

- **"Glimpse" wordmark** in the title bar: white-70 % on dark slide backgrounds, slate-70 % on the (light-mode) Settings slide.
- **Slide-indicator dots:** light dots on dark slides, dark dots on the (light-mode) Settings slide.

## Onboarding coachmarks

- **Built custom** (no `react-joyride` / `driver.js`) — the surface is small, design freedom matters for matching the dark-glass aesthetic, and Framer Motion handles the spotlight transitions cleanly.
- **Dim:** semi-opaque **60 % black** overlay.
- **Spotlight:** 8 px padding around the highlighted element, rounded corners.
- **Callout:** auto-positioned bubble, primary "Next" button, ghost "Skip" link.

See [onboarding.md](./onboarding.md) for the step-by-step content and behavior.
