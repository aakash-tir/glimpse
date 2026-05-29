# Slides

The window content is organized as a deck of slides. Slides are navigated by arrow buttons; transitions are 500 ms ease-in-out cube rotations. Slides loop in the click direction (no reverse-spin on wrap).

## Slide indicator + navigation bar

A single horizontal control row pinned to the bottom edge of the window:

```
[ ◂ ]   • • • • •   [ ▸ ]
```

- **Left and right arrow buttons** flank the indicator dots — no arrows on the panel side edges, no keyboard, no swipe.
- **Indicator dots** sit between the arrows: one dot per currently-active slide; the active slide's dot is larger. **Dot color is adaptive** — light dots on dark slide backgrounds, dark dots on the (light-mode) Settings slide.
- Arrow glyph color follows the same dark/light rule as the dots.
- Cube animation rotates **in the direction of the arrow click**. **500 ms ease-in-out.**
- Slides loop in the click direction (no reverse-spin on wrap).

## Dynamic slide count

Dot count grows / shrinks as the moon-phase toggle changes or events become active / inactive. **The currently-viewed slide does not shift** when others appear / disappear — the user stays on whatever they were looking at.

## Loading state (window mode)

When the window is opened before the first successful fetch, slides display **muted-grey skeleton placeholders** shaped like the real content (tiles, cards), with a **subtle horizontal sweep shimmer** repeating every ~1.5 s. Skeletons replace themselves with real content as data arrives.

---

## Slide 1 — Today (hourly)

- **Title:** "Today", centered along the top edge of the slide. Stays visible during the loading skeleton.
- **Each hour shows:** time (in user's 12 h / 24 h format) · condition icon (day/night variant) · temperature · precipitation %.
- **Range:** rolling next 24 hours, **starting at the next full hour** from now.
- **Layout:** horizontal scroll inside the slide; the cells are vertically centered in the visible area between the title and the bottom nav bar. **Visible cell count is responsive** — chosen so each cell stays roughly **48 px wide**: 5 cells at the default ~240 px window, more on wider windows, fewer on narrower (clamped to 3–8). **Snap-to-cell** — each scroll step advances by **one hour**, so the seen items shift one column rather than the whole page sliding off.
- **Side breathing room:** ~12 px of padding on the left and right of the scroll track so cells don't hug the panel edge.
- **Scroll affordance:** **white edge-fade glow** — ~14 px wide semi-transparent white **radial gradient** anchored at the panel-edge midpoint on whichever side(s) have more content to scroll to. The gradient ellipse uses horizontal radius = strip width and vertical radius = ½ slide-height, so the visible boundary traces a parenthesis-shaped curve: bulging deepest inward at the vertical middle and tapering back to the panel edge at top and bottom. Brightest white at the edge midpoint, fading to background outward along the curve. Disappears at the scroll boundary. Sits just inside the side padding so it overlays the first / last visible cell rather than the empty padding zone.
- **Background:** default dark glass.

## Slide 2 — Next 7 days

- **Title:** "Next 7 days", centered along the top edge of the slide. Stays visible during the loading skeleton.
- **Each daily row:** day label · condition icon · high / low · precipitation %.
- **Day labels:** "Today" in row 1, then weekday abbreviations (Mon, Tue, …) for the rest.
- **Range:** today + next 6 days.
- **Layout:** horizontal scroll; cells vertically centered in the visible area between the title and the bottom nav bar. **Visible cell count is responsive** — chosen so each cell stays roughly **80 px wide**: 3 days at the default ~240 px window, up to all 7 on wider windows (clamped to 2–7). **Snap-to-cell** — each scroll step advances by **one day**.
- **Scroll affordance:** same white edge-fade pattern as the hourly slide. Hidden when all 7 days fit in the visible viewport (no overflow).
- **Background:** default dark glass.

## Slide 3 — Current conditions

Four metric tiles:

- **Wind:** SVG arrow rotated by direction degrees + speed value.
- **Humidity:** percentage with a small drop icon.
- **Sunrise / sunset:** two times stacked vertically, each with a mini sun-up / sun-down icon.
- **Feels-like temperature:** numeric.
- **Background:** default dark glass.

## Slide 4 — Moon phase *(conditional, controlled by Settings toggle)*

Inserted before the special-events slide. Default toggle state is **off**.

- **Visual:** large stylized moon graphic with the curved shadow indicating the current phase.
- **Below:** phase name (e.g. "Waxing Gibbous") + illumination %.
- **Background:** deep navy (`#0a1628`).
- Pure phase info; does **not** signal special lunar events. (Those live on slide 5.)

## Slide 5 — Special events *(conditional)*

Only shown when ≥ 1 event is active today or calendar-tomorrow (system local timezone). One slide per active event.

- **Title style:** functional, not poetic — e.g. "Aurora", "Perseids meteor shower", "Total lunar eclipse", "Blood moon".
- **Tomorrow badge:** plain "Tomorrow" text (no date). Anchored top-right by default; if the centred title would overlap it (long title and/or narrow window) the badge drops to the bottom centre, just above the slide-count dots.
- **Event ordering when multiple are active:** today's events first, then tomorrow's; within each day, alphabetical by event type.
- **Theme:** event backgrounds **stay celestial-dark always**, regardless of the user's theme setting.
- Strictly passive — no notifications. **Full moon is NOT a special event.**

### Aurora

- Kp value · visibility text (user-aware: "Visible from your location" if user latitude crosses the threshold band, otherwise "Visible at latitudes ≥ Nº") · last-updated time.
- **Background:** linear gradient `#0a2e1f` → `#2a0a3e` (deep teal-green → deep violet).
- **Motion:** slow shimmer drift, ~30 s loop, opacity oscillates 0.85 → 1.0.

### Meteor shower

- Name (e.g. "Perseids") · peak date · expected ZHR (zenith hourly rate) · best viewing time.
- **Background:** solid `#0a0a1f` (near-black indigo) + 30 – 40 small white 4-point sparkle stars scattered across the slide at fixed (non-overlapping) positions (varied size & opacity — mostly faint, a few prominent — sized by a cubed-random bias). Each star slowly twinkles, breathing between its base opacity and ~30 % of it over a ~10 s cycle, each starting at a random phase so the field shimmers rather than pulsing in unison.
- **Motion:** occasional shooting star, roughly 1 every 6 s, ~0.6 s trajectory, fades at end. Each fire crosses the pane in a straight line from a random point on one window edge to a random point on the opposite edge (random angle), re-randomized per fire.

### Eclipse

- Covers **solar eclipses and partial / penumbral lunar eclipses**. A **total** lunar eclipse is a blood moon, so it routes to the blood-moon slide instead (one slide per event, no duplicate eclipse slide).
- Type label (in title) · peak time in user's local time (start / end times shown when present in the bundled JSON) · visibility text · magnitude % if available.
- **Visibility text** is a static string per entry in the bundled JSON (e.g. "Visible from: Americas, Pacific, East Asia"). We don't compute per-user yes/no/partial geometry — the static regions string is a good-enough cue for "does this apply to me?" without dragging in solar-eclipse path-of-totality math or per-user moon-altitude computation. Same handling for blood moon.
- **Background:** radial gradient `#1a0a0a` (center) → `#2a1010` (edges) with a centred eclipse silhouette — a dark occulting disc ringed by a glowing corona (the total-solar look).
- **Motion:** slow brightness pulse, 4 s period, ±5 % amplitude (the corona breathes on the same cadence).

### Blood moon

- Title "Blood moon" · peak time · start / end times (when present) · visibility text · magnitude % (same static-string / fields approach as eclipse — these are folded onto this slide since a total lunar eclipse no longer gets a separate eclipse slide).
- A blood moon slide appears whenever a **total lunar eclipse** is active — the totality phase reddens the moon. It is the *only* slide for that event (the generic eclipse slide is not also shown).
- **Background:** the same translucent dark-glass "window tint" the weather slides use (`rgba(15,23,42,0.92)`) so the desktop shows faintly through — not an opaque celestial gradient — with a faint, low-opacity blood-moon disc layered on top, centred behind the content. The disc is a red sphere gradient multiplied with a grayscale lunar-surface texture (`src/renderer/src/assets/moon.jpg`) so it shows craters/maria while staying red. (Diverges from the other event slides, which stay opaque celestial-dark; chosen so the blood moon reads as a tinted window with the reddened moon as the focal element.)
- **Motion:** none — the tint and disc are static.

## Slide 6 — Settings

Always last. **Vertically scrollable** within the slide.

- **Background:** follows the resolved theme — dark slate (`#0f172a`) in dark mode; off-white (`#f8fafc`) in light mode. (The only theme-adaptive slide background; all others stay dark.)

### Contents (top to bottom)

- **Units** — metric / imperial slider toggle. *Default: metric.*
- **Time format** — 12 h / 24 h toggle. *Default: 24 h.*
- **Moon-phase slide** — on / off toggle. *Default: off.*
- **Theme** — auto / light / dark. *Default: auto.*
- **Track window position** — on / off toggle. *Default: off.*
- **Reset icon position** — button.
- **Manual refresh** — button.
- **Replay tutorial** — button (re-runs the first-launch onboarding from step 1; see [onboarding.md](./onboarding.md)).
- **About** — app name "Glimpse" + credits line: `Weather data: Open-Meteo · Aurora data: NOAA SWPC · Astronomy: SunCalc`.
