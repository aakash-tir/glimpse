// Top-level UI mode, owned by the main process. The single Electron
// BrowserWindow is resized + reposed when mode flips; the renderer
// listens for `mode:changed` and swaps between IconView and WindowView.

export type Mode = 'icon' | 'window';

// Sent every time main initiates a mode change. `anchor` is the
// local-coord pivot for the renderer's entry animation in the new mode
// (= where the previous mode "lived" within the new window's coordinate
// space). `bounds` is the window's size at the moment of the change so
// the renderer can compute the icon-to-window scale ratio without
// depending on `window.innerWidth`, which momentarily lags `setBounds`.
// On the initial app load (no transition yet), the renderer fetches
// just the mode via `getMode` and treats anchor as null (no animation).
export type ModeChange = {
  mode: Mode;
  anchor: { x: number; y: number } | null;
  bounds: { width: number; height: number };
};
