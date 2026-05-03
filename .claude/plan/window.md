# Window (expanded state)

The weather panel that opens when the user clicks the [icon](./icon.md). Square, slide-based, no taskbar entry.

## Open / collapse

- Click icon → window **scales up out of the icon's current position over 200 ms ease-out**.
- On collapse, window scales back down to icon position over the same duration.
- When collapsed, the icon returns to the **window's last position** (window-center → icon-center). The icon is **clamped** to stay fully on-screen if the window's center was near a screen edge.
- **Special case:** if the window was at the canonical default position (primary's top-right) when collapsed, the icon snaps to the default top-right padded position.
- **Multi-monitor:** the window can be expanded on, dragged onto, and collapsed back from any connected display. `expandFromIcon` clamps the new bounds against the icon's display (not always primary), so an icon dragged onto the secondary monitor opens its window on the secondary too. Collapse mirrors this — the icon lands on whichever display the window's pending position resolves to. The "snap back to default" rule still uses the canonical primary default since that's THE default for the app.

## Size

- **Default size:** 1/6 of the primary monitor's smallest dimension on each side (true square — e.g. 180 × 180 on a 1080 p display).
- **Resizable** via the four corner handles only (no edge handles). Width and height are kept equal during resize.
  - **Min size:** 120 × 120 px.
  - **Max size:** smaller of (display width, display height) minus a small margin.

## Drag

- **Stuck in place** unless dragged. Drag is initiated by **double-click** on the window body; clicking outside exits.
- **Double-click is disabled on the arrow buttons** so navigation can't accidentally trigger drag.
- **Window drag bounds:** free placement, **constrained to fully fit on the cursor's current display** (the user can't drag the window off-screen — it hugs the display edge as the cursor approaches it). Multi-monitor: the window stays hugging the source display's edge until the cursor has moved far enough into the destination display that the whole window would fit there, then jumps. Same algorithm as the icon's drag clamp. Snap to the 4 screen corners of **any connected display** on release with **40 px** radius — drop near the secondary monitor's bottom-right and the window snaps flush to that corner, just on the secondary.
- **No padding constraint** in window mode — the window can span to screen corners. Padding applies only to the icon.

## Closing rules

- **Outside-click does NOT close the window.** Only title-bar controls or the title-bar weather icon collapse / close.
- **No Esc-to-close.** Only the title-bar **×** button quits the app.

## Window position persistence

- By default, the window always opens at the icon's current location and at the default size.
- Settings has a **"Track window position"** toggle (default: **off**). When on, the window's last size and position are stored to `settings.json` and restored next launch.
- If a tracked position is now off-screen (monitor change), fall back to default behavior.

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
