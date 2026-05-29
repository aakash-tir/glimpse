# First-launch onboarding

A short interactive tutorial that runs on the very first run and is replayable from the Settings slide.

## When it runs

- Detected by `onboardingCompleted` being absent or `false` in `settings.json`.
- Replayable later via the **"Replay tutorial"** button on the Settings slide (see [slides.md](./slides.md)).

## Rendering surface

The tutorial is **not** a desktop-wide dim and does **not** drive the live app windows. It runs as a **self-contained onboarding panel** sized to roughly **half the primary display's height** (square, clamped to fit the work area) and anchored **top-right** with the standard 16 px margin — near the icon's home. The main process resizes the single window to these bounds on first launch (when `onboardingCompleted` is false) and on replay.

Each step renders **mock representations** of the relevant UI inside this panel — the icon, slide arrows, title-bar buttons, resize handles, the sad-cloud — and the animated cursor demonstrates the gesture on the mock. This keeps onboarding self-contained: no second window, no whole-desktop dim, no OS-level click-through forwarding. The taught gestures are **demonstrated on the mocks**, not performed on the live app windows. On the final step the panel hands off to the real window (window mode) showing the Settings slide.

## Format

- **Visual style:** coachmark / spotlight overlay within the onboarding panel (see Rendering surface). Semi-opaque **60 % black** dim covers the panel except the mock element being explained, which is "spotlit" with **8 px padding** and rounded corners. A callout bubble points at the spotlit element with the explanation, **auto-positioned** within the panel.
- **Interaction:** only the spotlit mock element is interactive — performing its gesture advances the step. The rest of the dim swallows clicks.
- **Step counter:** dots along the bottom of the overlay (matches the slide indicator style).
- **Skip:** small "Skip tutorial" link, top-right of the overlay, no border.
- **Advancement:** **hybrid** — the user can either click "Next" in the callout, or perform the gesture being taught.
- **Pacing:** user-paced; no auto-advance.
- **Buttons:** primary "Next" button, ghost "Skip" link.
- **Text format:** **bold title + one-line description** ("**Slide navigation** — use the arrows to flip between slides."). Steps **4 (drag mode)** and **6 (resize)** use **title + two-line description** to mention the gesture nuance. Step **7 (offline preview)** also uses two lines.
- **Implementation:** custom-built; **no third-party library** (`react-joyride` / `driver.js` etc.) — small overlay surface, design freedom for the dark-glass aesthetic, easy to integrate with Framer Motion.

## Steps (in order)

1. **Welcome to Glimpse — click the icon to expand.** Coachmark on the icon. Brief greeting.
2. **Slide navigation.** Coachmarks on the left/right arrows. Animated cursor demonstrates a click.
3. **Switch between icon and window.** Click the title-bar weather icon or minimize button to collapse; click the icon to expand.
4. **Drag mode** *(two-line):* Double-click the icon (or window) to enter drag mode. Click outside to exit. Demonstrated for both icon and window. Animated cursor performs a double-click.
5. **Minimize button.** Coachmark on the title-bar minimize-to-icon button. Brief explanation that it collapses to the icon **and** resets it to the default top-right. (The standalone "relocate" button from earlier planning was removed in M3 — its reset-to-default behavior was absorbed into the minimize button.)
6. **Resize** *(two-line):* Drag any of the four corner handles to resize the window. Width and height stay equal — it's always a square. Animated cursor grabs the bottom-right corner and drags outward (grow direction only — does not demonstrate the min-size limit).
7. **Offline state preview** *(two-line):* Coachmark shows a sample sad-cloud icon (rendered inside the overlay — not the live icon, since the user is normally online during onboarding). Two lines: "If Glimpse can't reach the weather service, the icon will show a sad cloud. While it's like this, clicking the icon won't open the window — Glimpse will keep retrying in the background and recover on its own." Title bar is **not** force-visible during this step (the overlay carries the entire visual).
8. **Ends on the Settings slide.** Tutorial overlay disappears; window stays open. A brief "You're all set" toast appears for ~3 s.

## Animations

For gesture steps, an animated cursor icon performs the gesture in place, with a visible click ripple on each press.

## Behavior

- Runs **in parallel with first data fetch.** The data layer fetches in the background during onboarding; because the tutorial is a self-contained mock panel (see Rendering surface), the live slides aren't shown behind it — the real window reflects loading skeletons / error state only after the tutorial hands off.
- **Skip:** marks `onboardingCompleted = true`; never auto-shows again.
- **App closed mid-tutorial:** `onboardingCompleted` is **NOT** set; next launch restarts from step 1. (Skip and interrupt are deliberately differentiated — Skip is intentional, close is accidental.)
- **Continues during error state:** a failed first fetch never blocks the tutorial — it runs entirely on its own mock surface. (The real icon's sad-cloud appears after hand-off if the fetch failed; step 7 previews that state with a static sample.)
- **Completion criterion:** purely UX-driven — does not require the first fetch to have succeeded.
- **Auto-launch interaction:** `onboardingCompleted` is respected; auto-launches do not re-trigger onboarding.
- **Replay (from Settings):** closes the window, returns to icon mode, restarts from step 1.
- **Title bar visibility during the title-bar steps:** the mock title bar is shown during steps 3 and 5 (the icon-↔-window step and the minimize step both involve title-bar elements). It is hidden on the other steps, matching the app's auto-hide behavior.
- **Multi-monitor:** silent — onboarding runs on the primary monitor only.
