# Window (expanded state)

The weather panel that opens when the user clicks the [icon](./icon.md). Square, slide-based, no taskbar entry.

## Open / collapse

- Click icon → window **scales up out of the icon's current position over 200 ms ease-out**.
- On collapse, window scales back down to icon position over the same duration.

### Collapse paths and icon placement

Two collapse paths from the title bar; the in-place path has a richer set of rules. Authoritative spec is mirrored in `manual-tests-review.md` and the test cases.

- **Reset-to-default — minimize-to-icon button (2-square glyph).** Always restores both **size and position** to canonical defaults: icon at primary's top-right with 16 px padding; in-memory `lastWindowSize` cleared so the next expand uses default size; saved `windowBounds` cleared (when `trackWindowPosition` is on) so a relaunch doesn't restore the prior bounds. Independent of any drag/resize activity.

- **In-place collapse — title-bar weather-icon button (sun glyph).** Behavior depends on what the user did between expand and collapse. "Drag" means the window-drag gesture (double-click panel → mouse-drag), **not resize**.
  - **B1.** No drag, no resize → icon returns to the **exact same position it had at expand time**.
  - **B2.** Resize only (no drag) → same as B1. Resizing from any corner — including those that shift the window's top-left — does not relocate the icon. The gesture was "resize", not "move".
  - **B3.** Drag occurred (with or without resize) → icon position is derived from where the window ended up:
    - **B3a.** Window flush at a screen corner (after corner snap, ±2 px tolerance) → icon at that corner with 16 px padding.
    - **B3b.** Window flush against exactly one screen edge (after edge snap, not at a corner) → icon at that edge's midpoint with 16 px padding.
    - **B3c.** Window elsewhere → icon at the window's center.

- **Multi-monitor.** All B3 sub-rules apply on whichever display the window's center is on. Corners and edges in B3a / B3b refer to **that display's** corners and edges, not the primary's. `expandFromIcon` clamps the new bounds against the icon's display, so an icon dragged onto the secondary opens its window on the secondary. The reset-to-default rule still uses the canonical primary default since that's THE default for the app.

### Window-side snap (drag-end)

- **Corner snap** (40 px Euclidean): window flush against a screen corner, no padding.
- **Edge snap** (40 px perpendicular): window flush against a screen edge, position along the parallel axis preserved. Corner takes priority over edge when both are in radius.

## Size

- **Default size:** 1/6 of the primary monitor's smallest dimension on each side (true square — e.g. 180 × 180 on a 1080 p display).
- **Resizable** via the four corner handles only (no edge handles). Width and height are kept equal during resize.
  - **Min size:** 120 × 120 px.
  - **Max size:** the smaller of two caps — (a) the absolute cap, `min(displayW, displayH) - 16`, and (b) the per-corner cap, the largest size that still fits on the display containing the diagonal-fixed corner. The window can never grow off-screen, regardless of which corner is being dragged.

## Drag

- **Stuck in place** unless dragged. Drag is initiated by **double-click** on the window body; clicking outside exits.
- **Double-click is disabled on the arrow buttons** so navigation can't accidentally trigger drag.
- **Window drag bounds:** free placement, **constrained to fully fit on the cursor's current display** (the user can't drag the window off-screen — it hugs the display edge as the cursor approaches it). Multi-monitor: the window stays hugging the source display's edge until the cursor has moved far enough into the destination display that the whole window would fit there, then jumps. Same algorithm as the icon's drag clamp. Snap to the 4 screen corners of **any connected display** on release with **40 px** radius — drop near the secondary monitor's bottom-right and the window snaps flush to that corner, just on the secondary.
- **No padding constraint** in window mode — the window can span to screen corners. Padding applies only to the icon.

## Closing rules

- **Outside-click does NOT close the window.** Only title-bar controls or the title-bar weather icon collapse / close.
- **No Esc-to-close.** Only the title-bar **×** button quits the app.

## Window position + size persistence

- **Default** (toggle off): position always opens at the icon's current location. **Size** uses the in-session carry: if the user has resized the window earlier in the same session, that size is reused (at the icon's location). If they haven't resized yet, the default size is used. The in-session size is held in memory only — not written to `settings.json` — and resets on app start.
- **"Track window position"** toggle (default: **off**): when on, the window's full bounds (size **and** position) are persisted to `settings.json` on each collapse / drag-end / resize-end and restored on next launch.
- If a tracked position is now off-screen (monitor change), fall back to the default expand-from-icon behavior. The in-session size still applies if set.

## Title bar

- **Auto-hides** in window mode. **Trigger:** hovering the top edge (top ~24 px) reveals it. **150 ms fade-in, 300 ms fade-out.**
- Not present in icon mode.
- Background is consistent dark glass regardless of slide background (does NOT inherit per-slide background).

### Layout (left → center → right)

| Position | Element | Action |
|---|---|---|
| Left | Weather icon (current condition, day/night variant) | Click → collapse to icon mode **at the window's last position** (in-place collapse) |
| Center | "**Glimpse**" wordmark — regular weight, **adaptive** (white-70 % on dark slides, slate-70 % on light Settings slide), 14 px | Decorative |
| Right | Minimize-to-icon button (square with smaller square in top-right) | Collapse to icon mode **AND reset icon to default top-right** |
| Right | Close button (×) | Quit the app |

The two collapse paths are deliberately split: the **weather icon** keeps the icon where the window was; the **minimize button** sends it back to the default position. The previous design had a separate `CornerUpRight` "relocate" button alongside an in-place minimize, but the in-place behavior was duplicated by the weather icon, so the minimize button absorbed the relocate function and the standalone relocate button was removed.

### Title bar / drag-mode interaction

- Title bar is **not accessible while in drag mode** (must exit drag first).
- Clicking an **arrow button** while in window-drag mode **exits drag mode AND triggers navigation atomically** (single click does both).
