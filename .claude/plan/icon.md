# Icon (collapsed state)

The default surface of Glimpse. A small condition-aware icon pinned at the top-right of the primary monitor. Click to expand to the [window](./window.md).

## Position & size

- **Default position:** top-right of the primary monitor with **16 px padding** from the top and right edges.
- **Default resting size:** **64 × 64 px**.
- **Always-on-top:** no — behaves like a normal window in the OS z-order.
- **Position persistence:** dragged position saved to `settings.json`; restored on next launch.
- **Display change / monitor disconnect:** if the saved position is now off-screen, reset to default top-right.

## Visual

- Matches current weather conditions (sun, cloud, rain, snow, etc.).
- Uses the **day or night variant** of the icon based on the user's local sunrise / sunset times (see [data-sources.md](./data-sources.md)).
- Sourced from `react-icons/wi` (see [tech-stack.md](./tech-stack.md)).

## Interactions

- **Hover:** scales to **1.15×** over **150 ms ease-out**.
- **Single click:** expands into the weather window. Click registers after a **250 ms** custom threshold (snappier than the OS double-click default while still allowing double-click disambiguation).
- **Double-click (≤ 250 ms):** toggles drag mode.
  - While in drag mode, the icon is moved by **mousedown-and-drag-and-release** (no extra clicks needed).
  - Single-click on the icon while in drag mode is **ignored**.
  - **Clicking outside the icon exits drag mode.**
- **Drag-mode visual:** soft white outer glow, ~12 px blur, gentle 1 Hz pulse. (Same effect for the window when in window-drag mode.)
- **Snap to corners:** when dropped within **40 px** of any of the 4 screen corners, the icon snaps to that corner with the same 16 px padding preserved. Edges and centers do **not** snap.

## Background refresh

- The icon visual updates **every hour at :05** (clock-aligned, see [data-sources.md](./data-sources.md)) even when the window is closed.
- **Condition change animation:** when the displayed condition changes (e.g. sunny → cloudy), the icon **cross-fades over 200 ms** to the new variant.

## Loading state (initial fetch / no data yet)

Grey cloud silhouette. A horizontal white fill sweeps from left to right across the cloud over **2 seconds**; once fully white, the cloud snaps back to grey and the sweep restarts. Loops until the first successful fetch.

## Error state (weather fetch failed)

Sad-cloud icon at the regular 64 × 64 size. Hovering shows a custom dark-glass tooltip with the text **"weather could not be determined"**. Retry uses **exponential backoff doubling 5 → 10 → 20 → 40 → 60 min, capped at 1 h**, while the app is active. Backoff resets to 5 min only on a successful fetch. (See [data-sources.md](./data-sources.md) for active-state and refresh details; see [styling.md](./styling.md) for tooltip spec.)
