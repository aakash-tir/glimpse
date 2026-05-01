# First-launch onboarding

A short interactive tutorial that runs on the very first run and is replayable from the Settings slide.

## When it runs

- Detected by `onboardingCompleted` being absent or `false` in `settings.json`.
- Replayable later via the **"Replay tutorial"** button on the Settings slide (see [slides.md](./slides.md)).

## Format

- **Visual style:** coachmark / spotlight overlay. Semi-opaque **60 % black** dim covers the whole screen except the element being explained, which is "spotlit" with **8 px padding** and rounded corners. A callout bubble points at the spotlit element with the explanation, **auto-positioned** to fit on screen.
- **Click-through:** enabled only on the spotlit element (so the user can actually perform the gesture being taught). The rest of the overlay swallows clicks.
- **Step counter:** dots along the bottom of the overlay (matches the slide indicator style).
- **Skip:** small "Skip tutorial" link, top-right of the overlay, no border.
- **Advancement:** **hybrid** — the user can either click "Next" in the callout, or perform the gesture being taught.
- **Pacing:** user-paced; no auto-advance.
- **Buttons:** primary "Next" button, ghost "Skip" link.
- **Text format:** **bold title + one-line description** ("**Slide navigation** — use the arrows to flip between slides."). Steps **4 (drag mode)** and **6 (resize)** use **title + two-line description** to mention the gesture nuance.
- **Implementation:** custom-built; **no third-party library** (`react-joyride` / `driver.js` etc.) — small overlay surface, design freedom for the dark-glass aesthetic, easy to integrate with Framer Motion.

## Steps (in order)

1. **Welcome to Glimpse — click the icon to expand.** Coachmark on the icon. Brief greeting.
2. **Slide navigation.** Coachmarks on the left/right arrows. Animated cursor demonstrates a click.
3. **Switch between icon and window.** Click the title-bar weather icon or minimize button to collapse; click the icon to expand.
4. **Drag mode** *(two-line):* Double-click the icon (or window) to enter drag mode. Click outside to exit. Demonstrated for both icon and window. Animated cursor performs a double-click.
5. **Relocate button.** Coachmark on the title-bar relocate button. Brief explanation that it resets the icon to default top-right.
6. **Resize** *(two-line):* Drag any of the four corner handles to resize the window. Width and height stay equal — it's always a square. Animated cursor grabs the bottom-right corner and drags outward (grow direction only — does not demonstrate the min-size limit).
7. **Ends on the Settings slide.** Tutorial overlay disappears; window stays open. A brief "You're all set" toast appears for ~3 s.

## Animations

For gesture steps, an animated cursor icon performs the gesture in place, with a visible click ripple on each press.

## Behavior

- Runs **in parallel with first data fetch.** Slides show skeleton placeholders if reached before data arrives.
- **Skip:** marks `onboardingCompleted = true`; never auto-shows again.
- **App closed mid-tutorial:** `onboardingCompleted` is **NOT** set; next launch restarts from step 1. (Skip and interrupt are deliberately differentiated — Skip is intentional, close is accidental.)
- **Continues during error state:** if first fetch fails, sad cloud appears in the background but tutorial proceeds.
- **Completion criterion:** purely UX-driven — does not require the first fetch to have succeeded.
- **Auto-launch interaction:** `onboardingCompleted` is respected; auto-launches do not re-trigger onboarding.
- **Replay (from Settings):** closes the window, returns to icon mode, restarts from step 1.
- **Title bar visibility during the title-bar steps:** the title bar is force-visible during steps 3 and 5 (the icon-↔-window step and the relocate step both involve title-bar elements).
- **Multi-monitor:** silent — onboarding runs on the primary monitor only.
