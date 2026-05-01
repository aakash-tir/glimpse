# Window (expanded state)

The weather panel that opens when the user clicks the [icon](./icon.md). Square, slide-based, no taskbar entry.

## Open / collapse

- Click icon → window **scales up out of the icon's current position over 200 ms ease-out**.
- On collapse, window scales back down to icon position over the same duration.
- When collapsed, the icon returns to the **window's last position** (window-center → icon-center). The icon is **clamped** to stay fully on-screen if the window's center was near a screen edge.
- **Special case:** if the window was at the default position when collapsed, the icon snaps to the default top-right padded position.

## Size

- **Default size:** 1/6 of the primary monitor's smallest dimension on each side (true square — e.g. 180 × 180 on a 1080 p display).
- **Resizable** via the four corner handles only (no edge handles). Width and height are kept equal during resize.
  - **Min size:** 120 × 120 px.
  - **Max size:** smaller of (display width, display height) minus a small margin.

## Drag

- **Stuck in place** unless dragged. Drag is initiated by **double-click** on the window body; clicking outside exits.
- **Double-click is disabled on the arrow buttons** so navigation can't accidentally trigger drag.
- **Window drag bounds:** same as the icon — free placement on primary monitor + snap to the 4 screen corners with 40 px radius. (Snap padding does not apply to the window itself, only to the icon's resting position.)
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
| Left | Weather icon (current condition, day/night variant) | Click → collapse to icon mode |
| Center | "**Glimpse**" wordmark — regular weight, **adaptive** (white-70 % on dark slides, slate-70 % on light Settings slide), 14 px | Decorative |
| Right | Minimize-to-icon button (square with smaller square in top-right) | Collapse to icon mode |
| Right | Relocate button (`CornerUpRight` from `lucide-react`) | Reset icon position to default top-right |
| Right | Close button (×) | Quit the app |

### Title bar / drag-mode interaction

- Title bar is **not accessible while in drag mode** (must exit drag first).
- Clicking an **arrow button** while in window-drag mode **exits drag mode AND triggers navigation atomically** (single click does both).
