// Top-level UI mode, owned by the main process. The single Electron
// BrowserWindow is resized + reposed when mode flips; the renderer
// listens for `mode:changed` and swaps between IconView and WindowView.

export type Mode = 'icon' | 'window';
