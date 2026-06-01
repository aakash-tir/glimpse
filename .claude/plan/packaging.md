# Distribution / packaging

Two phases. Phase 1 is dev-mode only; Phase 2 produces the actual installer the user will run.

## Phase 1 — current

- Run from source: `npm run dev`.
- No packaging, no installer, no auto-launch.
- Vite's HMR drives renderer reloads; Electron main re-launches on its own changes.

## Phase 2 — after the app is functional (M10)

Package with **electron-builder** targeting NSIS.

| Artifact | Name |
|---|---|
| Installer | `Glimpse Setup.exe` |
| Start-menu entry | `Glimpse` |
| Installed binary | `Glimpse.exe` |

- **App icon source:** `./app-icon.png` — the **1024 × 1024 export** of the artwork (replaced the 256 × 256 stopgap at M10). This is the canonical source.
- **Embedded Windows icon:** `./app-icon.ico` — a **pre-generated multi-resolution `.ico`** (16/24/32/48/64/128/256) committed alongside the PNG; `build.win.icon` points at it and electron-builder embeds it into `Glimpse.exe`. We generate the `.ico` ourselves rather than relying on electron-builder's PNG → ICO conversion because v25 only emits a single 256 px entry from a PNG, which defeats the point of the 1024 source (crisp taskbar / Start-tile / Alt-Tab rendering at small sizes). Regenerate from `app-icon.png` if the artwork changes (Pillow: `Image.open('app-icon.png').save('app-icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])`).
- **Auto-launch:** `app.setLoginItemSettings({ openAtLogin: true })` runs on the installed build's first launch. Disable via Windows Settings → Apps → Startup like any other app.
- **No code signing.** Personal use, single-machine install.
- **No auto-update infrastructure.** When the user wants a new build, they uninstall + reinstall.
